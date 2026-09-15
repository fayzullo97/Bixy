import { describe, expect, it } from 'vitest';
import { JUMP_THROTTLE_MS, JUMP_TOTAL_MS, canJump, readLastJump } from './jump';

const T0 = 1_700_000_000_000;

describe('jump throttle (Part 06 §10)', () => {
  it('plays for a student who has never seen it', () => {
    expect(canJump(null, T0)).toBe(true);
  });

  it('does not replay within the hour', () => {
    expect(canJump(T0, T0 + 60_000)).toBe(false);
    expect(canJump(T0, T0 + JUMP_THROTTLE_MS - 1)).toBe(false);
  });

  it('plays again once the hour is up', () => {
    expect(canJump(T0, T0 + JUMP_THROTTLE_MS)).toBe(true);
  });

  it('is not locked out for an hour by a backwards clock', () => {
    expect(canJump(T0, T0 - 60_000)).toBe(true);
  });

  it('runs long enough to read as squash → launch → settle', () => {
    expect(JUMP_TOTAL_MS).toBeGreaterThan(500);
    expect(JUMP_TOTAL_MS).toBeLessThan(1200);
  });
});

describe('jump persistence (Part 06 §10)', () => {
  it('reads back a stored timestamp, so a reload still knows', () => {
    // The point of persisting rather than using a session flag: a flag resets
    // on exactly the in-and-out returns the throttle exists to cover.
    expect(readLastJump(String(T0))).toBe(T0);
    expect(canJump(readLastJump(String(T0)), T0 + 1000)).toBe(false);
  });

  it('treats missing or unreadable data as never-jumped', () => {
    expect(readLastJump(null)).toBeNull();
    expect(readLastJump('')).toBeNull();
    expect(readLastJump('not-a-number')).toBeNull();
    expect(readLastJump('0')).toBeNull();
  });
});
