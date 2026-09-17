import { TOPIC_LEVELS, type TopicLevel } from '../content/topic.js';

// The level map (Part 07 §9): what the All Levels grid and each level screen
// show. Pure — no I/O — so the status rules are unit-tested directly, the same
// way the path-progression rules in study-plan/plan.ts are.

/** A topic's state for the student looking at it. */
export type TopicStatus =
  /** Cleared — the quiz was passed. */
  | 'passed'
  /** Begun but not cleared. */
  | 'started'
  /** The topic the path is serving now: open, not yet cleared. */
  | 'current'
  /** Visible but not openable yet — it sits past the path's frontier (§9). */
  | 'locked';

/** A tier's state in the All Levels grid. */
export type LevelStatus = 'completed' | 'in_progress' | 'not_started';

export interface LevelTopicRow {
  topic_id: string;
  level: string;
  sort_order: number | null;
  key_idea?: string | null;
}

export interface LevelSummary {
  level: TopicLevel;
  status: LevelStatus;
  completed: number;
  total: number;
}

export interface LevelTopicView {
  topic_id: string;
  status: TopicStatus;
  key_idea: string | null;
}

/**
 * One topic's status. `current` and `passed` are the only openable states — the
 * card deck lets a student swipe to *see* an upcoming topic but not open it
 * until the current one is cleared (§9), and that gate is this function.
 *
 * Note a `started` topic is one the student opened and left; it stays openable
 * only while it is also the current path topic, which it normally is. A started
 * topic that has fallen behind the frontier (a detour that was abandoned) reads
 * as `started` and is openable — abandoning a detour shouldn't lock it away.
 */
export function topicStatus(
  topicId: string,
  currentTopicId: string | null,
  passed: ReadonlySet<string>,
  started: ReadonlySet<string>,
): TopicStatus {
  if (passed.has(topicId)) return 'passed';
  if (topicId === currentTopicId) return 'current';
  if (started.has(topicId)) return 'started';
  return 'locked';
}

/**
 * Per-tier counts and status for the All Levels grid (§9).
 *
 * A tier counts as `completed` only when every topic in it is passed; it is
 * `in_progress` when it has any passed topic OR it is the tier the student is
 * placed in — a freshly-placed student's own level should not read as untouched
 * next to six other untouched tiers.
 */
export function levelSummaries(
  topics: LevelTopicRow[],
  passed: ReadonlySet<string>,
  placement: TopicLevel | null,
): LevelSummary[] {
  return TOPIC_LEVELS.map((level) => {
    const atTier = topics.filter((t) => t.level === level);
    const completed = atTier.filter((t) => passed.has(t.topic_id)).length;
    const total = atTier.length;
    let status: LevelStatus = 'not_started';
    if (total > 0 && completed === total) status = 'completed';
    else if (completed > 0 || level === placement) status = 'in_progress';
    return { level, status, completed, total };
  });
}

/**
 * One tier's topics, in the order the study plan walks them.
 *
 * Ordering comes from the student's own `ordered_topic_ids` where the tier
 * appears in it, so the list matches the path they're actually walking. A tier
 * below their placement isn't in their plan at all — those fall back to authored
 * order, which is what the plan builder would have used anyway.
 */
export function levelTopics(
  level: TopicLevel,
  topics: LevelTopicRow[],
  orderedTopicIds: readonly string[],
  currentTopicId: string | null,
  passed: ReadonlySet<string>,
  started: ReadonlySet<string>,
): LevelTopicView[] {
  const atTier = topics.filter((t) => t.level === level);
  const planIndex = new Map(orderedTopicIds.map((id, i) => [id, i]));
  const ordered = [...atTier].sort((a, b) => {
    const ai = planIndex.get(a.topic_id);
    const bi = planIndex.get(b.topic_id);
    if (ai !== undefined && bi !== undefined) return ai - bi;
    if (ai !== undefined) return -1;
    if (bi !== undefined) return 1;
    const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
    const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
    if (ao !== bo) return ao - bo;
    return a.topic_id.localeCompare(b.topic_id);
  });
  return ordered.map((t) => ({
    topic_id: t.topic_id,
    status: topicStatus(t.topic_id, currentTopicId, passed, started),
    key_idea: t.key_idea ?? null,
  }));
}

/**
 * The index the current level's screen should scroll to on open (§9): only the
 * student's *current* level auto-scrolls, so this returns null for any other
 * tier — a completed or not-yet-reached tier has no in-progress position to
 * scroll to, and scrolling one anyway would hide its start.
 */
export function autoScrollIndex(
  level: TopicLevel,
  placement: TopicLevel | null,
  topics: LevelTopicView[],
): number | null {
  if (level !== placement) return null;
  const index = topics.findIndex((t) => t.status === 'current' || t.status === 'started');
  return index === -1 ? null : index;
}
