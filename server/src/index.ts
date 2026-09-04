import { env } from './config/env';
import { createApp } from './app';
import { createSupabase } from './db/supabase';
import { makeSession } from './modules/auth/session';
import { makeIdTokenVerifier, telegramRemoteJwks } from './modules/auth/verifyIdToken';
import { supabaseUsersRepo } from './modules/users/users.repo';
import { supabaseProgressRepo } from './modules/progress/progress.repo';
import { supabaseContentRepo } from './modules/content/content.repo';
import { anthropic, MODELS } from './modules/generation/anthropic';
import { supabaseLessonCacheRepo } from './modules/generation/lessonCache.repo';
import { createLessonService } from './modules/generation/pipeline';
import { createAssessmentService } from './modules/assessment/assessment';
import { supabaseLevelCheckRepo } from './modules/level-check/levelCheck.repo';
import { supabaseStudyPlanRepo } from './modules/study-plan/studyPlan.repo';
import { createStudyPlanService } from './modules/study-plan/studyPlan.service';
import { createAisha } from './modules/tts/aisha';

// Composition root: wire real implementations to the app's dependency contract.
const db = createSupabase();
const content = supabaseContentRepo(db);
const progress = supabaseProgressRepo(db);

const lessons = createLessonService({
  anthropic,
  models: { generation: MODELS.generation, topicId: MODELS.topicId },
  content,
  cache: supabaseLessonCacheRepo(db),
  tts: createAisha({
    apiKey: env.AISHA_API_KEY,
    baseUrl: env.AISHA_BASE_URL,
    mood: env.AISHA_MOOD,
  }),
  db,
});

const app = createApp({
  corsOrigin: env.CORS_ORIGIN,
  verifyIdToken: makeIdTokenVerifier({
    jwks: telegramRemoteJwks(env.TELEGRAM_JWKS_URL),
    issuer: env.TELEGRAM_ISSUER,
    audience: env.TELEGRAM_BOT_ID,
  }),
  session: makeSession({ secret: env.SESSION_SECRET, ttlDays: env.SESSION_TTL_DAYS }),
  users: supabaseUsersRepo(db),
  progress,
  content,
  lessons,
  assessment: createAssessmentService({ anthropic, model: MODELS.grade }),
  levelCheck: supabaseLevelCheckRepo(db),
  studyPlan: createStudyPlanService({ content, progress, plans: supabaseStudyPlanRepo(db) }),
  allowDevLogin: env.ALLOW_DEV_LOGIN,
});

app.listen(env.PORT, () => {
  console.log(`Whiteboard AI Tutor server listening on http://localhost:${env.PORT}`);
});
