/**
 * Bixy's anger level (Part 06 §10, Angry-Morph).
 *
 * Anger is a float 0–1, never a binary toggle — the character morphs
 * continuously between its calm and angry shapes, so every consumer reads a
 * level rather than a state. It rises on consecutive whole-topic re-teaches
 * (the same signal the persona tone shift already uses, Part 05 §8 — not a
 * second counter) and decays linearly to 0 over three hours of REAL time.
 *
 * Kept pure and derived from a timestamp rather than ticked down by a timer:
 * the decay has to continue correctly across app restarts, and a stored
 * "current level" would freeze while the app is closed and resume from the old
 * value hours later.
 */

/** Real time from a trigger back to calm. */
export const ANGER_DECAY_MS = 3 * 60 * 60 * 1000;

/** What one consecutive re-teach adds. Two of them — the same count that trips
 *  the persona's patient register (Part 05 §8) — reach full anger. */
export const ANGER_PER_STRIKE = 0.5;

export interface AngerState {
  /** Level at `triggeredAt`, before any decay. 0 when Bixy has never been angry. */
  level: number;
  /** When that level was set, as epoch ms. */
  triggeredAt: number;
}

export const CALM: AngerState = { level: 0, triggeredAt: 0 };

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** The level right now, decayed from when it was last set. */
export function angerAt(state: AngerState, now: number): number {
  if (state.level <= 0) return 0;
  const elapsed = now - state.triggeredAt;
  if (elapsed <= 0) return clamp01(state.level); // clock skew — don't amplify it
  if (elapsed >= ANGER_DECAY_MS) return 0;
  return clamp01(state.level * (1 - elapsed / ANGER_DECAY_MS));
}

/**
 * Apply one strike, on top of whatever is left of the previous one.
 *
 * Decaying first is what makes a second strike hours later feel like a fresh
 * annoyance rather than a resumed one, while two strikes in the same session
 * still stack to full.
 */
export function strike(state: AngerState, now: number): AngerState {
  return { level: clamp01(angerAt(state, now) + ANGER_PER_STRIKE), triggeredAt: now };
}

/**
 * Parse a persisted state; anything unreadable is treated as calm.
 *
 * Persisting the {level, triggeredAt} PAIR rather than a level is what lets the
 * three-hour decay keep running across restarts — a stored level alone would
 * freeze while the app is closed and resume hours later at its old value.
 */
export function readAngerState(raw: string | null): AngerState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AngerState>;
    if (typeof parsed?.level !== 'number' || typeof parsed?.triggeredAt !== 'number') return null;
    if (!Number.isFinite(parsed.level) || !Number.isFinite(parsed.triggeredAt)) return null;
    return { level: clamp01(parsed.level), triggeredAt: parsed.triggeredAt };
  } catch {
    return null;
  }
}

/** Anger ends the moment the student passes — the struggle it reacts to is over. */
export function clearAnger(): AngerState {
  return CALM;
}

/**
 * The streak the server reports (Part 05 §8) as an anger level.
 *
 * Read on arrival so a student returning to an unfinished struggle meets the
 * Bixy they left, rather than a calm one that re-escalates on the next failure.
 */
export function angerFromStreak(reteachAllStreak: number, now: number): AngerState {
  if (reteachAllStreak <= 0) return CALM;
  return { level: clamp01(reteachAllStreak * ANGER_PER_STRIKE), triggeredAt: now };
}
