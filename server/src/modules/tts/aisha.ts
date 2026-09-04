import type { TtsClient } from './client.js';
import { chunkByChars, concatWav, isPlausibleWav } from './wav.js';

// Aisha caps a single request at 1000 characters (verified live 2026-09-01:
// 1001 chars → 400 transcript_too_long). Counted in characters, not bytes.
const MAX_TEXT_CHARS = 1000;

export interface AishaConfig {
  apiKey: string;
  /** API host, e.g. https://back.aisha.group */
  baseUrl: string;
  /** Mood for the built-in uz (Gulnoza) flow: Neutral | Cheerful | Happy | Sad. */
  mood: string;
}

/**
 * AishaAI TTS client (§9.1). The sync endpoint returns 201 with an `audio_path`
 * (an absolute, public CDN URL) rather than raw WAV bytes; we fetch those bytes
 * immediately and hand them back so the pipeline can store them in our own
 * bucket — the CDN path is never persisted or treated as the source of truth.
 *
 * Language handling follows the API contract: `model`/`mood`/`speed` apply only
 * to the built-in `uz` (Gulnoza) flow and are omitted for `en`/`ru`. Long
 * narration is chunked to the 1000-character cap and the returned WAVs rejoined.
 */
export function createAisha(config: AishaConfig): TtsClient {
  return {
    enabled: config.apiKey.length > 0,

    async synthesize(text, language) {
      const chunks = chunkByChars(text, MAX_TEXT_CHARS);
      const wavs: Buffer[] = [];
      for (const chunk of chunks) {
        wavs.push(await synthesizeChunk(config, chunk, language));
      }
      return concatWav(wavs);
    },
  };
}

async function synthesizeChunk(config: AishaConfig, text: string, language: string): Promise<Buffer> {
  const form = new FormData();
  form.append('transcript', text);
  form.append('language', language);
  // model/mood/speed are only sent for the built-in uz (Gulnoza) flow; the API
  // rejects or ignores them for en/ru, which run a different path.
  if (language === 'uz') {
    form.append('model', 'Gulnoza');
    form.append('mood', config.mood);
    form.append('speed', '1.0');
  }

  const backoff = (attempt: number) => new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${config.baseUrl}/api/v1/tts/post/`, {
      method: 'POST',
      headers: { 'X-Api-Key': config.apiKey },
      body: form,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // 400 (bad transcript) and 402 (insufficient balance) are terminal — retrying
      // wastes time and, for 402, cannot succeed. Everything else is transient.
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`Aisha TTS failed: ${res.status} ${body.slice(0, 200)}`);
      }
      lastError = `${res.status} ${body.slice(0, 200)}`;
      await backoff(attempt);
      continue;
    }

    // We send no webhook, so we expect the synchronous 201 + audio_path. A 202
    // (async, no audio_path) would need the status-poll flow we deliberately
    // don't implement — fail loudly rather than silently drop the beat.
    const body = (await res.json().catch(() => null)) as { audio_path?: string } | null;
    if (!body?.audio_path) {
      throw new Error(`Aisha TTS: ${res.status} without audio_path — ${JSON.stringify(body).slice(0, 150)}`);
    }

    // audio_path is a public CDN URL that can be unreachable or expired by the
    // time we GET it, and a 200 there can still be an error page rather than a
    // WAV (§8.10 TTS). Both are transient — retry the whole synth on a blip
    // instead of permanently dropping this beat's audio.
    const audio = await fetch(body.audio_path).catch(() => null);
    if (!audio || !audio.ok) {
      lastError = `audio_path unreachable (${audio?.status ?? 'fetch error'}) for ${body.audio_path}`;
      await backoff(attempt);
      continue;
    }
    const wav = Buffer.from(await audio.arrayBuffer());
    if (!isPlausibleWav(wav)) {
      lastError = `audio_path returned ${wav.length}B of non-WAV data (200 is not proof of audio) for ${body.audio_path}`;
      await backoff(attempt);
      continue;
    }
    return wav;
  }
  throw new Error(`Aisha TTS failed: ${lastError}`);
}
