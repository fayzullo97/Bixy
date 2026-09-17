import type { ContentRepo } from '../content/content.repo.js';
import type { ProgressRepo } from '../progress/progress.repo.js';
import type { StudyPlanRepo } from '../study-plan/studyPlan.repo.js';
import { asTopicLevel, currentTopicId } from '../study-plan/plan.js';
import type { TopicLevel } from '../content/topic.js';
import {
  autoScrollIndex,
  levelSummaries,
  levelTopics,
  type LevelSummary,
  type LevelTopicView,
} from './levelMap.js';

/** The All Levels grid (§9): every tier, its counts, and where the student is. */
export interface LevelMapView {
  levels: LevelSummary[];
  /** The tier the student is placed in, or null if they're unplaced. */
  placement: string | null;
}

/** One level's screen (§9): its topics in path order, plus the open position. */
export interface LevelDetailView {
  level: string;
  topics: LevelTopicView[];
  /** Index to auto-scroll to — only ever non-null for the current level. */
  scroll_to: number | null;
}

export interface LevelsService {
  getMap(telegramId: string): Promise<LevelMapView>;
  getLevel(telegramId: string, level: TopicLevel): Promise<LevelDetailView>;
}

export interface LevelsDeps {
  content: ContentRepo;
  progress: ProgressRepo;
  plans: StudyPlanRepo;
}

/** Progress split into the two sets the status rules need. */
async function progressSets(
  progress: ProgressRepo,
  telegramId: string,
): Promise<{ passed: Set<string>; started: Set<string> }> {
  const records = await progress.listForUser(telegramId);
  return {
    passed: new Set(records.filter((r) => r.status === 'passed').map((r) => r.topic_id)),
    started: new Set(records.filter((r) => r.status === 'started').map((r) => r.topic_id)),
  };
}

export function createLevelsService(deps: LevelsDeps): LevelsService {
  return {
    async getMap(telegramId) {
      const [topics, plan, sets] = await Promise.all([
        deps.content.listTopicsForPlan(),
        deps.plans.get(telegramId),
        progressSets(deps.progress, telegramId),
      ]);
      const placement = plan ? asTopicLevel(plan.level) : null;
      return {
        levels: levelSummaries(topics, sets.passed, placement),
        placement: plan?.level ?? null,
      };
    },

    async getLevel(telegramId, level) {
      const [topics, plan, sets] = await Promise.all([
        deps.content.listTopicsForLevel(level),
        deps.plans.get(telegramId),
        progressSets(deps.progress, telegramId),
      ]);
      const ordered = plan?.ordered_topic_ids ?? [];
      // The served topic comes from the same walk the path itself uses, so a
      // level screen and the board can never disagree about what's current.
      const current = plan
        ? currentTopicId(ordered, plan.current_position, sets.passed)
        : null;
      const view = levelTopics(level, topics, ordered, current, sets.passed, sets.started);
      const placement = plan ? asTopicLevel(plan.level) : null;
      return {
        level,
        topics: view,
        scroll_to: autoScrollIndex(level, placement, view),
      };
    },
  };
}
