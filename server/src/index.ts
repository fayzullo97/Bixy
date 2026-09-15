import express from 'express';
import { env } from './config/env.js';
import { configureApp } from './createApp.js';
import { createSupabase } from './db/supabase.js';
import { makeSession } from './modules/auth/session.js';
import { makeInitDataVerifier } from './modules/auth/verifyInitData.js';
import { supabaseUsersRepo } from './modules/users/users.repo.js';
import { supabaseProgressRepo } from './modules/progress/progress.repo.js';
import { supabaseContentRepo } from './modules/content/content.repo.js';
import { anthropic, MODELS } from './modules/generation/anthropic.js';
import { supabaseLessonCacheRepo } from './modules/generation/lessonCache.repo.js';
import { supabaseVariantsRepo } from './modules/generation/variants.repo.js';
import { createLessonService } from './modules/generation/pipeline.js';
import { createAssessmentService } from './modules/assessment/assessment.js';
import { supabaseLevelCheckRepo } from './modules/level-check/levelCheck.repo.js';
import { supabaseStudyPlanRepo } from './modules/study-plan/studyPlan.repo.js';
import { createStudyPlanService } from './modules/study-plan/studyPlan.service.js';
import { createAisha } from './modules/tts/aisha.js';
import { createOpenAiTts } from './modules/tts/openai.js';
import { createTtsRouter } from './modules/tts/router.js';

// Composition root: wire real implementations to the app's dependency contract.
const db = createSupabase();
const content = supabaseContentRepo(db);
const progress = supabaseProgressRepo(db);

// Narration splits by language (Part 01 §2): Uzbek on AishaAI, Russian and
// English on OpenAI — one provider for those two so embedded English grammar
// terms inside Russian narration are spoken in the same voice.
const tts = createTtsRouter({
  uz: createAisha({
    apiKey: env.AISHA_API_KEY,
    baseUrl: env.AISHA_BASE_URL,
    mood: env.AISHA_MOOD,
  }),
  ru: createOpenAiTts({
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL,
    model: env.OPENAI_TTS_MODEL,
    voice: env.OPENAI_TTS_VOICE,
    instructions: env.OPENAI_TTS_INSTRUCTIONS || undefined,
  }),
  en: createOpenAiTts({
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL,
    model: env.OPENAI_TTS_MODEL,
    voice: env.OPENAI_TTS_VOICE,
    instructions: env.OPENAI_TTS_INSTRUCTIONS || undefined,
  }),
});

const lessons = createLessonService({
  anthropic,
  models: { generation: MODELS.generation, topicId: MODELS.topicId },
  content,
  cache: supabaseLessonCacheRepo(db),
  tts,
  db,
  transcribe: {
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL,
    model: env.OPENAI_TRANSCRIBE_MODEL,
  },
  variants: supabaseVariantsRepo(db),
});

const app = configureApp(express(), {
  corsOrigin: env.CORS_ORIGIN,
  verifyInitData: makeInitDataVerifier({
    botToken: env.TELEGRAM_BOT_TOKEN,
    maxAgeSeconds: env.TELEGRAM_INITDATA_MAX_AGE_SEC,
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

// Vercel's Express preset serves this default export as the Function. Locally
// (tsx / `npm run dev`), VERCEL is unset, so we start our own port listener instead.
export default app;

if (!process.env.VERCEL) {
  app.listen(env.PORT, () => {
    console.log(`Whiteboard AI Tutor server listening on http://localhost:${env.PORT}`);
  });
}
