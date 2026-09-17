import type { InitDataVerifier } from './modules/auth/verifyInitData.js';
import type { Session } from './modules/auth/session.js';
import type { UsersRepo } from './modules/users/users.repo.js';
import type { ProgressRepo } from './modules/progress/progress.repo.js';
import type { ContentRepo } from './modules/content/content.repo.js';
import type { LessonService } from './modules/generation/pipeline.js';
import type { AssessmentService } from './modules/assessment/assessment.js';
import type { LevelCheckRepo } from './modules/level-check/levelCheck.repo.js';
import type { StudyPlanService } from './modules/study-plan/studyPlan.service.js';
import type { LevelsService } from './modules/levels/levels.service.js';
import type { TtsClient } from './modules/tts/client.js';

/**
 * Everything the HTTP layer needs, injected at composition time. Real
 * implementations are wired in index.ts; tests pass in-memory fakes so routing,
 * auth, and session behavior can be exercised without a live Telegram or DB.
 */
export interface AppDeps {
  corsOrigin: string;
  /** Validates a Telegram Mini App initData string; throws on tampering/expiry. */
  verifyInitData: InitDataVerifier;
  session: Session;
  users: UsersRepo;
  progress: ProgressRepo;
  content: ContentRepo;
  lessons: LessonService;
  assessment: AssessmentService;
  levelCheck: LevelCheckRepo;
  studyPlan: StudyPlanService;
  /** The level map behind the home screen's level card and screens (Part 07 §9). */
  levels: LevelsService;
  /** Narration provider (§9.1). The greeting no longer goes through here — it
   *  serves pre-generated clips (see modules/tts/greetingClips.ts). */
  tts: TtsClient;
  /** DEV-ONLY: mount the Telegram-bypass sign-in route. Off in production. */
  allowDevLogin?: boolean;
}
