import { describe, expect, it } from 'vitest';
import { chunkWords, subtitleChunk, SUBTITLE_CHUNK_SIZE } from './subtitle';
import type { WordTiming } from './types';

/** Words at 100ms each, back to back. */
const words = (n: number): WordTiming[] =>
  Array.from({ length: n }, (_, i) => ({ text: `w${i}`, start_ms: i * 100, end_ms: (i + 1) * 100 }));

const texts = (ws: WordTiming[]) => ws.map((w) => w.text);

describe('chunkWords (Part 02 §3 — discrete chunks)', () => {
  it('never shows more than the band maximum', () => {
    for (let n = 1; n <= 60; n++) {
      for (const group of chunkWords(words(n))) {
        expect(group.length).toBeLessThanOrEqual(7);
      }
    }
  });

  it('reaches the band minimum once the unit is long enough to allow it', () => {
    // Below 10 words two groups of five don't fit, so the floor only holds from
    // there up — 8 pages as 4+4, which is a property of the band, not a bug.
    for (let n = 10; n <= 60; n++) {
      for (const group of chunkWords(words(n))) {
        expect(group.length).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('never leaves a short trailing orphan', () => {
    // 13 words split 7+6, not 6+6+1 — an even deal, not fixed slices.
    expect(chunkWords(words(13)).map((g) => g.length)).toEqual([7, 6]);
    expect(chunkWords(words(19)).map((g) => g.length)).toEqual([7, 6, 6]);
  });

  it('covers every word exactly once, in order', () => {
    const all = words(23);
    expect(chunkWords(all).flat()).toEqual(all);
  });

  it('gives a short unit a single group, even below the band', () => {
    expect(chunkWords(words(3))).toHaveLength(1);
    expect(chunkWords(words(3))[0]).toHaveLength(3);
  });

  it('returns nothing for no words', () => {
    expect(chunkWords([])).toEqual([]);
  });
});

describe('subtitleChunk (Part 02 §3 — discrete chunks)', () => {
  it('holds the whole chunk while its words are being spoken', () => {
    const all = words(12); // 6 + 6
    // Every position inside the first chunk shows the SAME six words — the
    // defining difference from the old rolling window, which advanced per word.
    const shown = [0, 150, 250, 350, 450, 550].map((ms) => texts(subtitleChunk(all, ms).words));
    for (const s of shown) expect(s).toEqual(['w0', 'w1', 'w2', 'w3', 'w4', 'w5']);
  });

  it('swaps the entire chunk at once when the last word finishes', () => {
    const all = words(12);
    // w5 ends at 600ms. At 599 the first chunk is still whole; at 600 the second
    // chunk is whole. Nothing partial in between — no word-by-word slide.
    expect(texts(subtitleChunk(all, 599).words)).toEqual(['w0', 'w1', 'w2', 'w3', 'w4', 'w5']);
    expect(texts(subtitleChunk(all, 600).words)).toEqual(['w6', 'w7', 'w8', 'w9', 'w10', 'w11']);
  });

  it('highlights the spoken word within the held chunk', () => {
    const all = words(12);
    expect(subtitleChunk(all, 0).activeIndex).toBe(0);
    expect(subtitleChunk(all, 250).activeIndex).toBe(2);
    expect(subtitleChunk(all, 550).activeIndex).toBe(5);
    // First word of the second chunk.
    expect(subtitleChunk(all, 600).activeIndex).toBe(0);
  });

  it('shows the opening chunk with nothing active during lead-in silence', () => {
    const lead: WordTiming[] = [{ text: 'hello', start_ms: 500, end_ms: 900 }];
    const { words: shown, activeIndex } = subtitleChunk(lead, 0);
    expect(texts(shown)).toEqual(['hello']);
    expect(activeIndex).toBe(-1);
  });

  it('keeps the final chunk up through trailing audio rather than blanking', () => {
    const { words: shown, activeIndex } = subtitleChunk(words(12), 9_999);
    expect(texts(shown)).toEqual(['w6', 'w7', 'w8', 'w9', 'w10', 'w11']);
    expect(activeIndex).toBe(5);
  });

  it('handles a unit shorter than one chunk', () => {
    const { words: shown, activeIndex } = subtitleChunk(words(3), 250);
    expect(shown).toHaveLength(3);
    expect(activeIndex).toBe(2);
  });

  it('returns nothing for a unit with no timings', () => {
    expect(subtitleChunk([], 0)).toEqual({ words: [], activeIndex: -1 });
  });

  it('exposes a chunk size inside the spec band', () => {
    expect(SUBTITLE_CHUNK_SIZE).toBeGreaterThanOrEqual(5);
    expect(SUBTITLE_CHUNK_SIZE).toBeLessThanOrEqual(7);
  });
});
