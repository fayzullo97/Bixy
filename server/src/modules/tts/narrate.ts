import type { TtsClient } from './client.js';
import { concatWav, readWavFormat, silenceWav, splitSentences, wavDurationMs } from './wav.js';

/**
 * Silence inserted between sentences (Part 02 §3). Reads as a thinking pause
 * rather than continuous reading, and because it's audio splicing rather than a
 * prompt instruction it behaves identically on every provider.
 */
export const SENTENCE_GAP_MS = 400;

/** One sentence clip's contribution to the joined audio. */
export interface SentenceTiming {
  text: string;
  /** Spoken length, excluding the gap that follows it. */
  duration_ms: number;
  /** Offset of this sentence's first sample within the joined clip. */
  start_ms: number;
}

export interface NarrationResult {
  wav: Buffer;
  sentences: SentenceTiming[];
  /** Total length of the joined clip, gaps included. */
  duration_ms: number;
}

/**
 * Synthesizes one narration unit as separate per-sentence TTS calls, spliced
 * back together with a fixed silence gap (Part 02 §3).
 *
 * Returns each sentence's exact duration and offset alongside the audio. Those
 * numbers are the proportional-timing fallback for subtitles: when Whisper
 * alignment is unavailable (Uzbek) or reconciliation fails, word timings can be
 * distributed across a sentence by character length, bounded to that sentence
 * rather than drifting across the whole beat.
 *
 * Sentences are synthesized concurrently — they're independent, and a beat can
 * hold half a dozen of them.
 */
export async function narrate(
  tts: TtsClient,
  text: string,
  language: string,
  gapMs: number = SENTENCE_GAP_MS,
): Promise<NarrationResult> {
  const parts = splitSentences(text);
  if (parts.length === 0) throw new Error('narrate: nothing to say');

  const clips = await Promise.all(parts.map((part) => tts.synthesize(part, language)));

  const format = readWavFormat(clips[0]!);
  const gap = gapMs > 0 ? silenceWav(gapMs, format) : null;
  const gapDuration = gap ? wavDurationMs(gap) : 0;

  const pieces: Buffer[] = [];
  const sentences: SentenceTiming[] = [];
  let cursor = 0;

  clips.forEach((clip, i) => {
    if (i > 0 && gap) {
      pieces.push(gap);
      cursor += gapDuration;
    }
    const duration = wavDurationMs(clip);
    sentences.push({ text: parts[i]!, duration_ms: duration, start_ms: cursor });
    cursor += duration;
    pieces.push(clip);
  });

  // concatWav takes its output format from the first buffer; every clip here is
  // from one provider for one language, and the gap was built to match it.
  const wav = pieces.length === 1 ? pieces[0]! : concatWav(pieces);
  return { wav, sentences, duration_ms: cursor };
}
