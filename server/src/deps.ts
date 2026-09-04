import type { IdTokenVerifier } from './modules/auth/verifyIdToken';
import type { Session } from './modules/auth/session';
import type { UsersRepo } from './modules/users/users.repo';
import type { ProgressRepo } from './modules/progress/progress.repo';
import type { ContentRepo } from './modules/content/content.repo';
import type { LessonService } from './modules/generation/pipeline';
import type { AssessmentService } from './modules/assessment/assessment';
import type { LevelCheckRepo } from './modules/level-check/levelCheck.repo';
import type { StudyPlanService } from './modules/study-plan/studyPlan.service';

/**
 * Everything the HTTP layer needs, injected at composition time. Real
 * implementations are wired in index.ts; tests pass in-memory fakes so routing,
 * auth, and session behavior can be exercised without a live Telegram or DB.
 */
export interface AppDeps {
  corsOrigin: string;
  verifyIdToken: IdTokenVerifier;
  session: Session;
  users: UsersRepo;
  progress: ProgressRepo;
  content: ContentRepo;
  lessons: LessonService;
  assessment: AssessmentService;
  levelCheck: LevelCheckRepo;
  studyPlan: StudyPlanService;
  /** DEV-ONLY: mount the Telegram-bypass sign-in route. Off in production. */
  allowDevLogin?: boolean;
}
