import { TOPIC_LEVELS, type TopicLevel } from '../content/topic';

// Pure helpers over a stored study plan (§8.12): which topic to serve next, how
// far the position should advance, and the dashboard's level stats. Kept out of
// the repo/service so the path-progression rules are unit-tested directly.

/**
 * The topic to serve next (§8.12): walk forward from the stored position and
 * return the first topic the student hasn't already passed. Detour topics —
 * out-of-path lessons cleared ahead of time — are marked passed in `passed`, so
 * they're skipped silently when the path reaches them, without moving position
 * backward. Returns null when the path is complete.
 */
export function currentTopicId(
  orderedTopicIds: string[],
  position: number,
  passed: ReadonlySet<string>,
): string | null {
  for (let i = Math.max(0, position); i < orderedTopicIds.length; i++) {
    const id = orderedTopicIds[i];
    if (id !== undefined && !passed.has(id)) return id;
  }
  return null;
}

/**
 * The position after clearing the topic that was current (§8.12): only advances
 * when `passedTopicId` is the sequence's current frontier — everything from the
 * position up to it is already passed. Clearing an out-of-path detour (a topic
 * ahead of the frontier, or behind the position) does not move the path. Returns
 * the index just past the cleared topic; the next read skips any passed topics
 * from there. Note the just-passed topic is typically already in `passed` (the
 * pass is recorded before this is called), so a plain "is it current" check
 * wouldn't fire — hence the frontier walk.
 */
export function advancedPosition(
  orderedTopicIds: string[],
  position: number,
  passed: ReadonlySet<string>,
  passedTopicId: string,
): number {
  const start = Math.max(0, position);
  const target = orderedTopicIds.indexOf(passedTopicId, start);
  if (target === -1) return position; // behind the position — a detour
  for (let i = start; i < target; i++) {
    if (!passed.has(orderedTopicIds[i]!)) return position; // ahead of the frontier — a detour
  }
  return target + 1;
}

export interface LevelStats {
  level: TopicLevel;
  completed: number;
  total: number;
}

/**
 * The dashboard's minimal stat (§8.12): how many topics at the student's
 * placement level they've passed, out of the total at that level. Deliberately
 * small for v1 — a single grammar-only number, not a fuller dashboard.
 */
export function levelStats(
  level: TopicLevel,
  topics: Array<{ topic_id: string; level: string }>,
  passed: ReadonlySet<string>,
): LevelStats {
  const atLevel = topics.filter((t) => t.level === level);
  const completed = atLevel.filter((t) => passed.has(t.topic_id)).length;
  return { level, completed, total: atLevel.length };
}

/** Narrow a stored/level string to a TopicLevel, or null if it isn't one. */
export function asTopicLevel(value: string): TopicLevel | null {
  return (TOPIC_LEVELS as readonly string[]).includes(value) ? (value as TopicLevel) : null;
}
