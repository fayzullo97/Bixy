import type { HeardWord } from './transcribe.js';
import type { SentenceTiming } from './narrate.js';

/** One script word with the playback time it should appear at. */
export interface WordTiming {
  text: string;
  start_ms: number;
  end_ms: number;
}

/** Comparison form: case-folded, punctuation stripped, ё→е so Whisper's
 *  orthography differences don't read as mismatches. */
function norm(word: string): string {
  return word
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}']/gu, '');
}

/** The script's own words, in order, as the subtitle will display them. */
export function scriptWords(text: string): string[] {
  return text.split(/\s+/u).filter(Boolean);
}

/**
 * Reconciles Whisper's blindly-transcribed words against the script's known
 * words (Part 02 §3).
 *
 * Required, not optional: `whisper-1` transcribes rather than force-aligns, so
 * it drops words, merges them, and hears them wrong. The subtitle must display
 * the SCRIPT's words — what Bixy actually said — timed by whatever Whisper got
 * right.
 *
 * Longest-common-subsequence over normalized forms: matched script words take
 * the heard timing directly; runs of unmatched words are spread evenly across
 * the gap between their nearest matched neighbours, so a mis-heard word still
 * advances the window at a plausible moment instead of stalling it.
 *
 * Returns null when too little matched to trust — the caller then falls back to
 * proportional timing rather than showing a window that drifts out of sync.
 */
export function alignToScript(
  words: string[],
  heard: HeardWord[],
  totalMs: number,
  minMatchRatio = 0.5,
): WordTiming[] | null {
  if (words.length === 0) return null;

  const a = words.map(norm);
  const b = heard.map((h) => norm(h.text));

  // LCS table over normalized tokens.
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i]![j] = a[i] && a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
    }
  }

  // Walk the table, recording which heard word each script word matched.
  const matchedTo = new Array<number>(n).fill(-1);
  let i = 0;
  let j = 0;
  let matches = 0;
  while (i < n && j < m) {
    if (a[i] && a[i] === b[j]) {
      matchedTo[i] = j;
      matches++;
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      i++;
    } else {
      j++;
    }
  }

  if (matches / words.length < minMatchRatio) return null;

  // Anchor matched words to heard timings, then interpolate the runs between.
  const out: WordTiming[] = words.map((text) => ({ text, start_ms: 0, end_ms: 0 }));
  for (let k = 0; k < n; k++) {
    const h = matchedTo[k]!;
    if (h >= 0) {
      out[k]!.start_ms = heard[h]!.start_ms;
      out[k]!.end_ms = heard[h]!.end_ms;
    }
  }

  let k = 0;
  while (k < n) {
    if (matchedTo[k]! >= 0) {
      k++;
      continue;
    }
    const runStart = k;
    while (k < n && matchedTo[k]! < 0) k++;
    const runEnd = k; // exclusive
    const before = runStart > 0 ? out[runStart - 1]!.end_ms : 0;
    const after = runEnd < n ? out[runEnd]!.start_ms : Math.max(totalMs, before);
    const span = Math.max(after - before, 0);
    const each = span / (runEnd - runStart);
    for (let x = runStart; x < runEnd; x++) {
      out[x]!.start_ms = Math.round(before + each * (x - runStart));
      out[x]!.end_ms = Math.round(before + each * (x - runStart + 1));
    }
  }

  return out;
}

/**
 * Proportional timing fallback (Part 02 §3): distributes each sentence's known
 * duration across its own words by character length.
 *
 * Less precise than real alignment, but bounded per sentence — error cannot
 * accumulate across a whole beat, because every sentence re-anchors to an exact
 * offset measured from the spliced audio.
 */
export function proportionalTiming(sentences: SentenceTiming[]): WordTiming[] {
  const out: WordTiming[] = [];
  for (const sentence of sentences) {
    const words = scriptWords(sentence.text);
    const total = words.reduce((n, w) => n + w.length, 0) || 1;
    let cursor = sentence.start_ms;
    for (const word of words) {
      const span = (word.length / total) * sentence.duration_ms;
      out.push({ text: word, start_ms: Math.round(cursor), end_ms: Math.round(cursor + span) });
      cursor += span;
    }
  }
  return out;
}
