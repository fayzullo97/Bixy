import type { WordTiming } from './types';

/**
 * Target words per subtitle chunk (Part 02 §3).
 *
 * The spec's band is 5–7; 6 is the middle of it, so an even split lands inside
 * the band from either direction (see `chunkWords` — a group is nudged to 5 or 7
 * rather than leaving a 1-word orphan at the end).
 */
export const SUBTITLE_CHUNK_SIZE = 6;

/** Smallest and largest a chunk may become once the split is balanced. */
const MIN_CHUNK = 5;
const MAX_CHUNK = 7;

/**
 * Split a unit's words into fixed display groups.
 *
 * No group ever exceeds the band's maximum of 7. Groups reach the minimum of 5
 * whenever the unit is long enough to allow it (10 words or more); below that
 * there simply aren't enough words to fill two groups of five, so a unit of 8 or
 * 9 pages as 4+4 or 5+4, and a unit shorter than one group is left whole.
 */
export function chunkWords(
  words: WordTiming[],
  size: number = SUBTITLE_CHUNK_SIZE,
): WordTiming[][] {
  if (words.length === 0) return [];
  const target = Math.min(Math.max(size, MIN_CHUNK), MAX_CHUNK);
  if (words.length <= target) return [words];

  // Pick the group COUNT first, rounding to whichever count lands closest to the
  // target, then deal the words out evenly across it. Rounding rather than
  // `ceil` is what keeps groups near the target instead of collapsing to the
  // minimum (13 words → 2 groups of 7+6, where `ceil` would give 3 of 5+4+4);
  // dealing evenly rather than slicing fixed lengths off the front is what stops
  // the remainder piling up as a short trailing orphan.
  let count = Math.max(1, Math.round(words.length / target));
  // Never show more than the band's maximum at once, even if that costs a
  // shorter final group — a unit of 8 pages as 4+4 rather than one line of 8.
  while (Math.ceil(words.length / count) > MAX_CHUNK) count += 1;

  const base = Math.floor(words.length / count);
  let extra = words.length % count;

  const chunks: WordTiming[][] = [];
  let index = 0;
  for (let i = 0; i < count; i++) {
    const take = base + (extra > 0 ? 1 : 0);
    if (extra > 0) extra -= 1;
    chunks.push(words.slice(index, index + take));
    index += take;
  }
  return chunks;
}

/**
 * The subtitle chunk to display at a moment in playback (Part 02 §3).
 *
 * **Discrete chunks, not a rolling window.** The original build slid one word at
 * a time — a word left the left edge as a word entered the right, keeping the
 * spoken word centred — which reads as continuous horizontal drift and is hard
 * to actually read from. Instead a whole chunk is held on screen until every
 * word in it has been spoken, then the entire chunk is replaced at once. The
 * text is therefore still for the duration of a chunk, and changes in one step.
 *
 * `activeIndex` is the index WITHIN the returned chunk of the word being spoken,
 * or -1 before the first word of that chunk starts. Highlighting still tracks
 * the voice word by word; only the *paging* is discrete.
 *
 * Selection rule: show the first chunk whose last word has not finished. Keyed
 * on `end_ms` rather than on the next chunk's `start_ms` so the final chunk of a
 * unit stays up through its own trailing audio instead of needing a special case.
 */
export function subtitleChunk(
  words: WordTiming[],
  positionMs: number,
  size: number = SUBTITLE_CHUNK_SIZE,
): { words: WordTiming[]; activeIndex: number } {
  if (words.length === 0) return { words: [], activeIndex: -1 };

  const chunks = chunkWords(words, size);
  // The first chunk still holding the playhead. Past the end of the last word,
  // the final chunk stays up rather than blanking the caption.
  const chunk =
    chunks.find((group) => positionMs < group[group.length - 1]!.end_ms) ??
    chunks[chunks.length - 1]!;

  // The last word in THIS chunk that has started. -1 while the chunk is shown
  // slightly ahead of its own first word (the swap happens on the previous
  // chunk's end, which can land in the gap before this one begins).
  let activeIndex = -1;
  for (let i = 0; i < chunk.length; i++) {
    if (chunk[i]!.start_ms <= positionMs) activeIndex = i;
    else break;
  }

  return { words: chunk, activeIndex };
}
