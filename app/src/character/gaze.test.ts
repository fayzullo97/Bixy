import { describe, expect, it } from 'vitest';
import {
  BLINK_INTERVAL_MS,
  GAZE_BOW,
  GAZE_DIRECTIONS,
  GAZE_OFFSETS,
  nextBlinkDelayMs,
  nextGaze,
  nextGazeTiming,
} from './gaze';

/** A random source that replays a fixed sequence, then repeats the last value. */
function seeded(values: number[]) {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)]!;
}

describe('look-around (Part 06 §10)', () => {
  it('stays front whenever Bixy is addressing the student', () => {
    // The standing rule: greeting, narrating, or angry — gaze does not wander.
    for (const r of [0, 0.5, 0.99]) {
      expect(nextGaze(seeded([r, r]), true)).toBe('front');
    }
  });

  it('returns to front often, so the wandering does not read as darting', () => {
    expect(nextGaze(seeded([0.1]), false)).toBe('front');
    expect(nextGaze(seeded([0.49]), false)).toBe('front');
  });

  it('picks among the four side targets otherwise', () => {
    const picked = new Set<string>();
    for (const r of [0.0, 0.3, 0.6, 0.99]) {
      picked.add(nextGaze(seeded([0.9, r]), false));
    }
    expect(picked).toEqual(new Set(['top_left', 'left', 'top_right', 'right']));
    expect(picked.has('front')).toBe(false);
  });

  it('never returns an out-of-range target at the top of the random range', () => {
    expect(GAZE_DIRECTIONS).toContain(nextGaze(seeded([0.9, 1]), false));
  });

  it('holds a glance, then waits before the next one', () => {
    const { holdMs, gapMs } = nextGazeTiming(seeded([0, 0]));
    expect(holdMs).toBe(900);
    expect(gapMs).toBe(1600);
    const long = nextGazeTiming(seeded([1, 1]));
    expect(long.holdMs).toBe(2200);
    expect(long.gapMs).toBe(4200);
  });

  it('moves eyes, mouth and sparkle together, and not at all at front', () => {
    expect(GAZE_OFFSETS.front).toEqual({ x: 0, y: 0 });
    expect(GAZE_OFFSETS.left.x).toBeLessThan(0);
    expect(GAZE_OFFSETS.right.x).toBeGreaterThan(0);
    expect(GAZE_OFFSETS.top_left.y).toBeLessThan(0);
  });

  it('bows the eye by direction, and exactly zero at front', () => {
    // 0 has to be exact: it must reproduce the straight-line source art, not
    // approximate it.
    expect(GAZE_BOW.front).toBe(0);
    expect(GAZE_BOW.left).toBeLessThan(0);
    expect(GAZE_BOW.right).toBeGreaterThan(0);
    expect(GAZE_BOW.right).toBe(-GAZE_BOW.left);
  });
});

describe('blink (Part 06 §10)', () => {
  it('is irregular, so it does not read as a metronome', () => {
    expect(nextBlinkDelayMs(seeded([0]))).toBe(BLINK_INTERVAL_MS.min);
    expect(nextBlinkDelayMs(seeded([1]))).toBe(BLINK_INTERVAL_MS.max);
    expect(nextBlinkDelayMs(seeded([0.5]))).toBeGreaterThan(BLINK_INTERVAL_MS.min);
  });
});
