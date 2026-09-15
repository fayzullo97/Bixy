import { describe, expect, it } from 'vitest';
import { subtitleWindow, SUBTITLE_WINDOW } from './subtitle';
import type { WordTiming } from './types';

/** Words at 100ms each. */
const words = (n: number): WordTiming[] =>
  Array.from({ length: n }, (_, i) => ({ text: `w${i}`, start_ms: i * 100, end_ms: (i + 1) * 100 }));

describe('subtitleWindow (Part 02 §3)', () => {
  it('shows at most the window size, not the whole beat', () => {
    const { words: shown } = subtitleWindow(words(30), 0);
    expect(shown).toHaveLength(SUBTITLE_WINDOW);
  });

  it('keeps most of the window AHEAD of the spoken word', () => {
    // At w10, the window starts at w8 — so 4 of the 7 visible words are still
    // to come. That's the point: the student reads slightly ahead of the voice.
    const { words: shown, activeIndex } = subtitleWindow(words(30), 1000);
    expect(shown[0]!.text).toBe('w8');
    expect(activeIndex).toBe(2);
    expect(shown.slice(activeIndex + 1).map((w) => w.text)).toEqual(['w11', 'w12', 'w13', 'w14']);
  });

  it('rolls forward as playback advances', () => {
    const all = words(30);
    const a = subtitleWindow(all, 500).words[0]!.text;
    const b = subtitleWindow(all, 1500).words[0]!.text;
    expect(a).toBe('w3');
    expect(b).toBe('w13');
  });

  it('does not scroll past the end into an empty window', () => {
    const { words: shown, activeIndex } = subtitleWindow(words(10), 9_999);
    expect(shown.map((w) => w.text)).toEqual(['w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9']);
    expect(shown).toHaveLength(SUBTITLE_WINDOW);
    expect(activeIndex).toBe(6);
  });

  it('shows the opening words with nothing active during lead-in silence', () => {
    const lead: WordTiming[] = [{ text: 'hello', start_ms: 500, end_ms: 900 }];
    const { words: shown, activeIndex } = subtitleWindow(lead, 0);
    expect(shown.map((w) => w.text)).toEqual(['hello']);
    expect(activeIndex).toBe(-1);
  });

  it('handles a beat shorter than the window', () => {
    const { words: shown, activeIndex } = subtitleWindow(words(3), 250);
    expect(shown).toHaveLength(3);
    expect(activeIndex).toBe(2);
  });

  it('returns nothing for a unit with no timings', () => {
    expect(subtitleWindow([], 0)).toEqual({ words: [], activeIndex: -1 });
  });
});
