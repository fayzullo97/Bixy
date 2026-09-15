import { describe, expect, it } from 'vitest';
import {
  ANGER_DECAY_MS,
  ANGER_PER_STRIKE,
  CALM,
  angerAt,
  angerFromStreak,
  clearAnger,
  readAngerState,
  strike,
} from './anger';

const T0 = 1_700_000_000_000;

describe('anger level (Part 06 §10)', () => {
  it('is a float, not a toggle — one strike is partial anger', () => {
    const state = strike(CALM, T0);
    expect(angerAt(state, T0)).toBe(ANGER_PER_STRIKE);
    expect(angerAt(state, T0)).toBeLessThan(1);
  });

  it('reaches full anger on the second consecutive strike', () => {
    const state = strike(strike(CALM, T0), T0);
    expect(angerAt(state, T0)).toBe(1);
  });

  it('never exceeds full anger however many strikes land', () => {
    let state = CALM;
    for (let i = 0; i < 10; i++) state = strike(state, T0);
    expect(angerAt(state, T0)).toBe(1);
  });

  it('decays linearly to calm over three hours', () => {
    const state = strike(strike(CALM, T0), T0); // full anger
    expect(angerAt(state, T0 + ANGER_DECAY_MS / 2)).toBeCloseTo(0.5, 5);
    expect(angerAt(state, T0 + ANGER_DECAY_MS)).toBe(0);
    expect(angerAt(state, T0 + ANGER_DECAY_MS * 2)).toBe(0);
  });

  it('keeps decaying across a restart, since the level is derived from a timestamp', () => {
    // The app was closed for an hour; the level must reflect that, not resume
    // from where it was when the last frame rendered.
    const state = strike(strike(CALM, T0), T0);
    expect(angerAt(state, T0 + 60 * 60 * 1000)).toBeCloseTo(2 / 3, 5);
  });

  it('stacks a second strike onto what is LEFT of the first', () => {
    const first = strike(CALM, T0); // 0.5
    const later = T0 + ANGER_DECAY_MS / 2; // decayed to 0.25
    expect(angerAt(strike(first, later), later)).toBeCloseTo(0.75, 5);
  });

  it('ignores a backwards clock rather than amplifying the level', () => {
    const state = strike(CALM, T0);
    expect(angerAt(state, T0 - 60_000)).toBe(ANGER_PER_STRIKE);
  });

  it('is calm when it has never been triggered', () => {
    expect(angerAt(CALM, T0)).toBe(0);
  });

  it('clears outright on a pass', () => {
    expect(angerAt(clearAnger(), T0)).toBe(0);
  });

  it('persists the level AND its trigger time, so decay survives a restart', () => {
    // Storing a bare level would freeze it while the app is closed and resume
    // hours later at the old value.
    const state = strike(strike(CALM, T0), T0);
    const restored = readAngerState(JSON.stringify(state))!;
    expect(restored).toEqual(state);
    expect(angerAt(restored, T0 + ANGER_DECAY_MS / 2)).toBeCloseTo(0.5, 5);
  });

  it('treats unreadable stored anger as calm rather than guessing', () => {
    expect(readAngerState(null)).toBeNull();
    expect(readAngerState('not json')).toBeNull();
    expect(readAngerState('{"level":1}')).toBeNull();
    expect(readAngerState('{"level":"lots","triggeredAt":1}')).toBeNull();
  });

  it('restores the level from the server-side streak on arrival', () => {
    expect(angerAt(angerFromStreak(0, T0), T0)).toBe(0);
    expect(angerAt(angerFromStreak(1, T0), T0)).toBe(0.5);
    expect(angerAt(angerFromStreak(2, T0), T0)).toBe(1);
    expect(angerAt(angerFromStreak(5, T0), T0)).toBe(1);
  });
});
