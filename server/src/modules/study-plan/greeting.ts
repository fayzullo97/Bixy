// The board's continue-prompt greeting varies by recency (§8.12): the first
// prompt of a calendar day gets the full greeting; any later prompt the same day
// gets a short "Welcome back" before the same continue question. Pure so the
// day-boundary logic is unit-tested directly.

export type GreetingVariant = 'full' | 'short';

/** The full set of arrival stages, including the one-time first meeting (Part 05 §7). */
export type GreetingStage = GreetingVariant | 'first_meeting';

/** Local calendar day key (YYYY-MM-DD). A simple day boundary, not per-student
 *  timezone awareness — a v1 simplification the doc explicitly sanctions. */
function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Which greeting to show now, given when the student was last greeted. `full` if
 * they've never been greeted or were last greeted on an earlier day; `short` for
 * a repeat visit the same day (§8.12).
 */
export function greetingVariant(lastGreetedAt: string | null, now: Date = new Date()): GreetingVariant {
  if (!lastGreetedAt) return 'full';
  const last = new Date(lastGreetedAt);
  if (Number.isNaN(last.getTime())) return 'full';
  return dayKey(last) === dayKey(now) ? 'short' : 'full';
}

/**
 * The greeting stage for this arrival (Part 05 §7).
 *
 * `first_meeting` is the one-time introduction: Bixy says who it is and asks the
 * get-to-know-you questions. It fires on the arrival that starts the student's
 * first lesson, not as a stage before the level check — a student who has just
 * been placed has already spent fifteen questions with the app, and a ceremony
 * before that would delay the thing they came to do.
 *
 * Gated on `metAt` rather than on "have they ever been greeted": skipping the
 * conversation still stamps `metAt`, so a student who skipped is never asked
 * again. Once met, the existing day-boundary rule takes over unchanged.
 */
export function greetingStage(
  user: { met_at?: string | null; last_greeted_at?: string | null },
  now: Date = new Date(),
): GreetingStage {
  if (!user.met_at) return 'first_meeting';
  return greetingVariant(user.last_greeted_at ?? null, now);
}
