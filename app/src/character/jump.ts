/**
 * The throttle that keeps the app-open Jump special (Part 06 §10).
 *
 * The shape of the jump lives in `idle.ts` with the other keyframes; this is
 * only the throttle.
 *
 * Once per hour, against a PERSISTED timestamp rather than a session flag: the
 * reason the throttle exists is that a student who bounces in and out of the app
 * all morning would otherwise see the same flourish every time, and a session
 * flag resets on exactly those returns. The persistence itself lives in
 * `jumpStorage.ts` — this file stays free of React Native imports so it can be
 * unit-tested.
 */

export const JUMP_THROTTLE_MS = 60 * 60 * 1000;

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
