import type { WordTiming } from './types';

/** How many words of narration are on screen at once (Part 02 §3). */
export const SUBTITLE_WINDOW = 7;

/**
 * How many already-spoken words stay visible behind the current one. The rest of
 * the window runs ahead, so the student reads slightly ahead of Bixy's voice
 * rather than watching words appear under it.
 */
const TRAIL = 2;

/**
 * The rolling subtitle window at a moment in playback (Part 02 §3).
 *
 * Replaces dumping the whole beat at once: a window of `size` words that
 * advances with the audio, keeping the currently-spoken word near its start so
 * most of what's visible is what's coming next.
 *
 * `activeIndex` is the index WITHIN the returned window of the word being
 * spoken, or -1 before the first word starts.
 */
export function subtitleWindow(
  words: WordTiming[],
  positionMs: number,
  size: number = SUBTITLE_WINDOW,
): { words: WordTiming[]; activeIndex: number } {
  if (words.length === 0) return { words: [], activeIndex: -1 };

  // The last word that has started. -1 while the clip leads in with silence.
  let current = -1;
  for (let i = 0; i < words.length; i++) {
    if (words[i]!.start_ms <= positionMs) current = i;
    else break;
  }

  // Anchor the window so the current word sits TRAIL places in, then clamp at
  // the end so the final words don't scroll past into an empty window.
  const maxStart = Math.max(0, words.length - size);
  const start = Math.min(Math.max(0, current - TRAIL), maxStart);
  return {
    words: words.slice(start, start + size),
    activeIndex: current < 0 ? -1 : current - start,
  };
}
