/**
 * The app-open Jump (Part 06 §10), and the throttle that keeps it special.
 *
 * Squash → launch → settle, played once when the app opens. Throttled to once
 * per hour against a PERSISTED timestamp rather than a session flag: the reason
 * the throttle exists is that a student who bounces in and out of the app all
 * morning would otherwise see the same flourish every time, and a session flag
 * resets on exactly those returns. The persistence itself lives in
 * `jumpStorage.ts` — this file stays free of React Native imports so it can be
 * unit-tested.
 */

export const JUMP_THROTTLE_MS = 60 * 60 * 1000;

/** Phase durations, in order. Launch overshoots; settle lands with one bounce. */
export const JUMP_PHASES_MS = { squash: 180, launch: 260, settle: 340 };

export const JUMP_TOTAL_MS = JUMP_PHASES_MS.squash + JUMP_PHASES_MS.launch + JUMP_PHASES_MS.settle;

/** Whether enough time has passed since the last jump. */
export function canJump(lastJumpAt: number | null, now: number): boolean {
  if (lastJumpAt === null) return true;
  // A clock that moved backwards shouldn't lock the jump out for an hour.
  if (now < lastJumpAt) return true;
  return now - lastJumpAt >= JUMP_THROTTLE_MS;
}

/** Parse a persisted timestamp; anything unreadable counts as never-jumped. */
export function readLastJump(raw: string | null): number | null {
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}
