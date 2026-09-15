import { describe, expect, it } from 'vitest';
import { FLOAT_AMPLITUDE, FLOAT_PERIOD_MS, breathe, floatOffset, jumpFrame } from './idle';
import { JUMP_PHASES_MS, JUMP_TOTAL_MS } from './jump';

describe('float (Part 06 §10)', () => {
  it('starts from rest, so the character does not pop on mount', () => {
    expect(floatOffset(0)).toBe(0);
  });

  it('bobs up and back down over one period', () => {
    expect(floatOffset(FLOAT_PERIOD_MS / 4)).toBeCloseTo(FLOAT_AMPLITUDE, 5);
    expect(floatOffset(FLOAT_PERIOD_MS / 2)).toBeCloseTo(0, 5);
    expect(floatOffset((FLOAT_PERIOD_MS * 3) / 4)).toBeCloseTo(-FLOAT_AMPLITUDE, 5);
    expect(floatOffset(FLOAT_PERIOD_MS)).toBeCloseTo(0, 5);
  });

  it('stays within its amplitude', () => {
    for (let t = 0; t < FLOAT_PERIOD_MS * 3; t += 37) {
      expect(Math.abs(floatOffset(t))).toBeLessThanOrEqual(FLOAT_AMPLITUDE + 1e-9);
    }
  });
});

describe('breathe (Part 06 §10)', () => {
  it('is barely-there, never a visible squish', () => {
    for (let t = 0; t < FLOAT_PERIOD_MS; t += 53) {
      const { scaleX, scaleY } = breathe(t);
      expect(Math.abs(scaleX - 1)).toBeLessThan(0.02);
      expect(Math.abs(scaleY - 1)).toBeLessThan(0.02);
    }
  });

  it('preserves volume — widening as it shortens', () => {
    const { scaleX, scaleY } = breathe(FLOAT_PERIOD_MS / 4);
    expect(scaleX).toBeLessThan(1);
    expect(scaleY).toBeGreaterThan(1);
  });

  it('rides the same clock as float, so the two read as one movement', () => {
    expect(breathe(0).scaleX).toBe(1);
    expect(breathe(FLOAT_PERIOD_MS / 2).scaleX).toBeCloseTo(1, 9);
  });
});

describe('jump (Part 06 §10)', () => {
  it('is at rest before and after the run', () => {
    expect(jumpFrame(-1).active).toBe(false);
    expect(jumpFrame(JUMP_TOTAL_MS)).toMatchObject({ lift: 0, scaleX: 1, scaleY: 1, active: false });
  });

  it('squashes first — shorter and wider, still on the ground', () => {
    const frame = jumpFrame(JUMP_PHASES_MS.squash - 1);
    expect(frame.lift).toBe(0);
    expect(frame.scaleY).toBeLessThan(1);
    expect(frame.scaleX).toBeGreaterThan(1);
  });

  it('launches upward, taller and thinner than normal', () => {
    const frame = jumpFrame(JUMP_PHASES_MS.squash + JUMP_PHASES_MS.launch - 1);
    expect(frame.lift).toBeGreaterThan(20);
    expect(frame.scaleY).toBeGreaterThan(1);
    expect(frame.scaleX).toBeLessThan(1);
  });

  it('settles back to exactly rest, leaving nothing offset behind', () => {
    const last = jumpFrame(JUMP_TOTAL_MS - 0.001);
    expect(last.lift).toBeCloseTo(0, 3);
    expect(last.scaleX).toBeCloseTo(1, 2);
    expect(last.scaleY).toBeCloseTo(1, 2);
  });

  it('never leaves the ground during the squash, and never sinks below it', () => {
    for (let t = 0; t < JUMP_TOTAL_MS; t += 5) {
      expect(jumpFrame(t).lift).toBeGreaterThanOrEqual(0);
    }
  });
});
