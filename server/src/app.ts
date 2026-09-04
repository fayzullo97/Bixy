import 'express-async-errors';
import cors from 'cors';
import express, { type Express } from 'express';
import type { AppDeps } from './deps.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { devLoginRoutes } from './modules/auth/devLogin.routes.js';
import { userRoutes } from './modules/users/user.routes.js';
import { progressRoutes } from './modules/progress/progress.routes.js';
import { contentRoutes } from './modules/content/content.routes.js';
import { lessonsRoutes } from './modules/generation/lessons.routes.js';
import { assessmentRoutes } from './modules/assessment/assessment.routes.js';
import { levelCheckRoutes } from './modules/level-check/levelCheck.routes.js';
import { studyPlanRoutes } from './modules/study-plan/studyPlan.routes.js';

/**
 * Builds the Express app from injected dependencies. No process globals, no DB
 * client created here — everything comes in via `deps`, which is what makes the
 * whole HTTP surface testable with fakes.
 */
export function createApp(deps: AppDeps): Express {
  const app = express();

  app.use(cors({ origin: deps.corsOrigin }));
  // Headroom for a base64 photo attachment on /lessons/ask (§8.5). The client
  // downscales before upload, so this is a ceiling, not the expected size.
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.use('/auth', authRoutes(deps));
  app.use('/me', userRoutes(deps));
  app.use('/progress', progressRoutes(deps));
  app.use('/content', contentRoutes(deps));
  app.use('/lessons', lessonsRoutes(deps));
  app.use('/assessment', assessmentRoutes(deps));
  app.use('/level-check', levelCheckRoutes(deps));
  app.use('/study-plan', studyPlanRoutes(deps));

  if (deps.allowDevLogin) {
    app.use('/auth/dev-login', devLoginRoutes(deps));
    console.warn(
      '[SECURITY] Dev login ENABLED — POST /auth/dev-login bypasses Telegram validation. Local use only.',
    );
  }

  app.use(errorHandler);
  return app;
}
