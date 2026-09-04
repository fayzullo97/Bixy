// The board's continue-prompt greeting varies by recency (§8.12): the first
// prompt of a calendar day gets the full greeting; any later prompt the same day
// gets a short "Welcome back" before the same continue question. Pure so the
// day-boundary logic is unit-tested directly.

export type GreetingVariant = 'full' | 'short';

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
