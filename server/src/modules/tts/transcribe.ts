/** One word as Whisper heard it, with its timing inside the clip. */
export interface HeardWord {
  text: string;
  start_ms: number;
  end_ms: number;
}

export interface TranscribeConfig {
  apiKey: string;
  baseUrl: string;
  /** Transcription model. whisper-1 is the one with word-level granularity. */
  model: string;
}

/**
 * Languages we trust Whisper to time (Part 02 §3). Uzbek is NOT in Whisper's
 * documented language list, so alignment accuracy on Aisha audio needs its own
 * test before we rely on it — until then Uzbek lessons keep the full-text
 * subtitle display rather than a window driven by guessed timings.
 */
const ALIGNABLE = new Set(['en', 'ru']);

export function canAlign(language: string): boolean {
  return ALIGNABLE.has(language);
}

/**
 * Word-level timings for one clip, via `whisper-1`.
 *
 * This is BLIND TRANSCRIPTION, not forced alignment: the endpoint does not
 * constrain output to text we already know, so the words that come back are not
 * guaranteed to match the script. Callers must reconcile the result against the
 * script's own words (see `alignToScript`) rather than trusting it directly.
 *
 * The script text is still passed as `prompt`, which biases decoding toward the
 * expected wording — it improves the hit rate but guarantees nothing.
 *
 * Returns null on any failure. Subtitles are an enhancement: a failed alignment
 * falls back to proportional timing, never to a broken lesson.
 */
export async function transcribeWords(
  config: TranscribeConfig,
  wav: Buffer,
  language: string,
  scriptText: string,
): Promise<HeardWord[] | null> {
  if (!config.apiKey || !canAlign(language)) return null;

  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'narration.wav');
  form.append('model', config.model);
  form.append('language', language);
  // Word granularity requires verbose_json — the plain json format has no timings.
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');
  form.append('prompt', scriptText.slice(0, 900));

  try {
    const res = await fetch(`${config.baseUrl}/v1/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.apiKey}` },
      body: form,
    });
    if (!res.ok) {
      console.error(`[whisper] ${res.status} ${(await res.text().catch(() => '')).slice(0, 160)}`);
      return null;
    }
    const body = (await res.json()) as { words?: Array<{ word: string; start: number; end: number }> };
    if (!Array.isArray(body.words) || body.words.length === 0) return null;
    return body.words.map((w) => ({
      text: w.word,
      start_ms: Math.round(w.start * 1000),
      end_ms: Math.round(w.end * 1000),
    }));
  } catch (error) {
    console.error('[whisper] transcription failed:', (error as Error).message);
    return null;
  }
}
