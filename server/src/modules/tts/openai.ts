import type { TtsClient } from './client.js';
import { chunkByChars, concatWav, isPlausibleWav, normalizeWav } from './wav.js';

// OpenAI caps `input` at 4096 characters. Narration beats are prompt-capped at
// ~500 chars (§8.2), so this should never split in practice — it's here so an
// over-long beat degrades into two requests instead of a hard 400.
const MAX_TEXT_CHARS = 4096;

export interface OpenAiTtsConfig {
  apiKey: string;
  /** API host, e.g. https://api.openai.com */
  baseUrl: string;
  /** Speech model, e.g. gpt-4o-mini-tts. */
  model: string;
  /** Voice id, e.g. alloy. Bixy is gender-ambiguous (§Part 00), so the default
   *  is a neutral one; Part 05 (persona) may want a say here. */
  voice: string;
  /** Optional tone steer sent as `instructions` (gpt-4o-mini-tts only). */
  instructions?: string;
}

/**
 * OpenAI TTS client (Part 01 §2) — the Russian AND English narration provider.
 * One provider for both is the whole point: a Russian narration carrying
 * embedded English grammar terms ("Present Perfect") is spoken in a single
 * voice, with no vendor-switch seam and no Russian accent on the English terms.
 *
 * `language` is therefore deliberately unused — the model handles mid-sentence
 * switching natively, so there is no per-language parameter to send. It stays in
 * the signature because it's part of the provider-neutral `TtsClient` contract.
 */
export function createOpenAiTts(config: OpenAiTtsConfig): TtsClient {
  return {
    enabled: config.apiKey.length > 0,

    async synthesize(text) {
      const chunks = chunkByChars(text, MAX_TEXT_CHARS);
      const wavs: Buffer[] = [];
      for (const chunk of chunks) {
        wavs.push(await synthesizeChunk(config, chunk));
      }
      return concatWav(wavs);
    },
  };
}

async function synthesizeChunk(config: OpenAiTtsConfig, text: string): Promise<Buffer> {
  const backoff = (attempt: number) => new Promise((r) => setTimeout(r, 400 * 2 ** attempt));
  let lastError = '';

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${config.baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        input: text,
        voice: config.voice,
        // WAV, not the mp3 default: it keeps the whole downstream path
        // (isPlausibleWav, concatWav, uploadNarration's audio/wav) unchanged, so
        // adding this provider doesn't make the storage layer format-aware.
        response_format: 'wav',
        ...(config.instructions ? { instructions: config.instructions } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      // 400 (bad input) and 401 (bad key) are terminal — retrying cannot succeed.
      // 429 and 5xx are transient. Same split as the Aisha client.
      if (res.status !== 429 && res.status < 500) {
        throw new Error(`OpenAI TTS failed: ${res.status} ${body.slice(0, 200)}`);
      }
      lastError = `${res.status} ${body.slice(0, 200)}`;
      await backoff(attempt);
      continue;
    }

    // A 200 only proves bytes came back, not that they're usable audio (§8.10).
    // The API streams its WAV, so the chunk sizes arrive as 0xFFFFFFFF
    // placeholders — normalize to real lengths before judging or storing.
    const wav = normalizeWav(Buffer.from(await res.arrayBuffer()));
    if (!isPlausibleWav(wav)) {
      lastError = `200 returned ${wav.length}B of non-WAV data (a status code is not proof of audio)`;
      await backoff(attempt);
      continue;
    }
    return wav;
  }

  throw new Error(`OpenAI TTS failed: ${lastError}`);
}
