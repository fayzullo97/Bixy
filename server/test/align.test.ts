import { describe, expect, it } from 'vitest';
import { alignToScript, proportionalTiming, scriptWords } from '../src/modules/tts/align';
import { canAlign } from '../src/modules/tts/transcribe';
import type { HeardWord } from '../src/modules/tts/transcribe';

const heard = (pairs: Array<[string, number, number]>): HeardWord[] =>
  pairs.map(([text, start_ms, end_ms]) => ({ text, start_ms, end_ms }));

describe('alignToScript — reconciling blind transcription (Part 02 §3)', () => {
  it('takes heard timings when everything matches', () => {
    const timings = alignToScript(
      scriptWords('the cat sat'),
      heard([['the', 0, 100], ['cat', 100, 300], ['sat', 300, 500]]),
      500,
    );
    expect(timings).toEqual([
      { text: 'the', start_ms: 0, end_ms: 100 },
      { text: 'cat', start_ms: 100, end_ms: 300 },
      { text: 'sat', start_ms: 300, end_ms: 500 },
    ]);
  });

  it('ignores punctuation and case differences in what Whisper returns', () => {
    const timings = alignToScript(
      scriptWords('Hmm, let me think.'),
      heard([['Hmm', 0, 200], ['let', 200, 300], ['me', 300, 400], ['think', 400, 600]]),
      600,
    );
    // The SCRIPT's spelling is displayed — Whisper's is only used for timing.
    expect(timings!.map((t) => t.text)).toEqual(['Hmm,', 'let', 'me', 'think.']);
    expect(timings![0]!.start_ms).toBe(0);
  });

  it('interpolates a word Whisper dropped, between its matched neighbours', () => {
    const timings = alignToScript(
      scriptWords('the big cat sat'),
      heard([['the', 0, 100], ['cat', 500, 600], ['sat', 600, 800]]),
      800,
    );
    // "big" was never heard; it gets the gap between "the" and "cat" rather than
    // stalling the window or inheriting a neighbour's timestamp.
    expect(timings![1]).toEqual({ text: 'big', start_ms: 100, end_ms: 500 });
  });

  it('spreads a run of several dropped words evenly', () => {
    // 2 of 5 matched is below the default confidence floor, so the threshold is
    // lowered here to exercise interpolation itself; the floor has its own test.
    const timings = alignToScript(
      scriptWords('a b c d e'),
      heard([['a', 0, 100], ['e', 500, 600]]),
      600,
      0.3,
    );
    expect(timings!.map((t) => t.start_ms)).toEqual([0, 100, 233, 367, 500]);
  });

  it('keeps timings monotonic — the window never moves backwards', () => {
    const timings = alignToScript(
      scriptWords('one two three four five six'),
      heard([['one', 0, 90], ['three', 300, 380], ['six', 900, 1000]]),
      1000,
    )!;
    for (let i = 1; i < timings.length; i++) {
      expect(timings[i]!.start_ms).toBeGreaterThanOrEqual(timings[i - 1]!.start_ms);
    }
  });

  it('gives up when too little matched, rather than showing a drifting window', () => {
    const timings = alignToScript(
      scriptWords('the cat sat on the mat'),
      heard([['completely', 0, 100], ['different', 100, 200], ['words', 200, 300]]),
      300,
    );
    expect(timings).toBeNull();
  });

  it('handles Whisper hearing extra words that were never said', () => {
    const timings = alignToScript(
      scriptWords('the cat sat'),
      heard([['the', 0, 100], ['uh', 100, 150], ['cat', 150, 300], ['sat', 300, 500]]),
      500,
    );
    expect(timings!.map((t) => t.text)).toEqual(['the', 'cat', 'sat']);
    expect(timings![1]!.start_ms).toBe(150);
  });
});

describe('proportionalTiming — the fallback', () => {
  it('distributes each sentence’s duration across its words by length', () => {
    const timings = proportionalTiming([
      { text: 'ab cd', duration_ms: 400, start_ms: 0 },
      { text: 'ef', duration_ms: 200, start_ms: 800 },
    ]);
    expect(timings).toEqual([
      { text: 'ab', start_ms: 0, end_ms: 200 },
      { text: 'cd', start_ms: 200, end_ms: 400 },
      { text: 'ef', start_ms: 800, end_ms: 1000 },
    ]);
  });

  it('re-anchors at every sentence, so error cannot accumulate across a beat', () => {
    const timings = proportionalTiming([
      { text: 'one', duration_ms: 100, start_ms: 0 },
      { text: 'two', duration_ms: 100, start_ms: 5000 },
    ]);
    // The second sentence starts at its measured offset regardless of the first.
    expect(timings[1]!.start_ms).toBe(5000);
  });
});

describe('canAlign — the rollout gate', () => {
  it('covers English and Russian, not Uzbek', () => {
    // Uzbek is not in Whisper's documented language list; those lessons keep the
    // full-text subtitle display until a dedicated accuracy test passes.
    expect(canAlign('en')).toBe(true);
    expect(canAlign('ru')).toBe(true);
    expect(canAlign('uz')).toBe(false);
  });
});
