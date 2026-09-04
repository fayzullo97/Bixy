import type { ContentRepo } from '../content/content.repo.js';
import type { ProgressRepo } from '../progress/progress.repo.js';
import type { StudyPlanRepo, StudyPlanRecord } from './studyPlan.repo.js';
import { buildStudyPlan } from './buildPlan.js';
import { advancedPosition, currentTopicId, levelStats, asTopicLevel, type LevelStats } from './plan.js';

/** What the client needs to drive the path + dashboard (§8.12). */
export interface StudyPlanView {
  level: string;
  ordered_topic_ids: string[];
  current_position: number;
  /** The topic to serve next, or null when the path is complete. */
  current_topic_id: string | null;
  stats: LevelStats;
}

export interface StudyPlanService {
  /** (Re)build the plan after a placement — a new/different level rebuilds; the
   *  same level leaves the existing plan and progress untouched (§8.12). */
  rebuildForPlacement(telegramId: string, level: string): Promise<void>;
  /** The student's plan view, or null if they have none yet (unplaced). */
  getForUser(telegramId: string): Promise<StudyPlanView | null>;
  /** Advance the path after clearing a topic; a detour pass is a no-op (§8.12). */
  advance(telegramId: string, passedTopicId: string): Promise<StudyPlanView | null>;
}

export interface StudyPlanDeps {
  content: ContentRepo;
  progress: ProgressRepo;
  plans: StudyPlanRepo;
}

async function passedSet(progress: ProgressRepo, telegramId: string): Promise<Set<string>> {
  const records = await progress.listForUser(telegramId);
  return new Set(records.filter((r) => r.status === 'passed').map((r) => r.topic_id));
}

async function toView(deps: StudyPlanDeps, record: StudyPlanRecord): Promise<StudyPlanView> {
  const [topics, passed] = await Promise.all([
    deps.content.listTopicsForPlan(),
    passedSet(deps.progress, record.telegram_id),
  ]);
  const level = asTopicLevel(record.level) ?? 'A1';
  return {
    level: record.level,
    ordered_topic_ids: record.ordered_topic_ids,
    current_position: record.current_position,
    current_topic_id: currentTopicId(record.ordered_topic_ids, record.current_position, passed),
    stats: levelStats(level, topics, passed),
  };
}

export function createStudyPlanService(deps: StudyPlanDeps): StudyPlanService {
  return {
    async rebuildForPlacement(telegramId, level) {
      const existing = await deps.plans.get(telegramId);
      if (existing && existing.level === level) return; // same placement — keep it
      const topicLevel = asTopicLevel(level);
      if (!topicLevel) throw new Error(`invalid placement level: ${level}`);
      const topics = await deps.content.listTopicsForPlan();
      await deps.plans.replace(telegramId, level, buildStudyPlan(topicLevel, topics));
    },

    async getForUser(telegramId) {
      const record = await deps.plans.get(telegramId);
      return record ? toView(deps, record) : null;
    },

    async advance(telegramId, passedTopicId) {
      const record = await deps.plans.get(telegramId);
      if (!record) return null;
      const passed = await passedSet(deps.progress, telegramId);
      const next = advancedPosition(
        record.ordered_topic_ids,
        record.current_position,
        passed,
        passedTopicId,
      );
      if (next !== record.current_position) {
        await deps.plans.setPosition(telegramId, next);
        record.current_position = next;
      }
      return toView(deps, record);
    },
  };
}
