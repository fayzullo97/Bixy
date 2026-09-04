import { Router } from 'express';
import type { AppDeps } from '../../deps.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import type { ProgressPatch } from './progress.repo.js';

/** Pull only known, well-typed fields out of the request body. */
function sanitizePatch(body: unknown): ProgressPatch | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const patch: ProgressPatch = {};

  if (b.status !== undefined) {
    if (b.status !== 'started' && b.status !== 'passed') return null;
    patch.status = b.status;
  }
  if (b.quiz_score !== undefined) {
    if (b.quiz_score !== null && typeof b.quiz_score !== 'number') return null;
    patch.quiz_score = b.quiz_score as number | null;
  }
  if (b.last_completed_beat !== undefined) {
    if (b.last_completed_beat !== null && typeof b.last_completed_beat !== 'number') return null;
    patch.last_completed_beat = b.last_completed_beat as number | null;
  }
  if (b.mastered !== undefined) {
    if (typeof b.mastered !== 'boolean') return null;
    patch.mastered = b.mastered;
  }
  return patch;
}

export function progressRoutes(deps: AppDeps): Router {
  const router = Router();
  router.use(requireAuth(deps.session));

  // All progress for the signed-in student (§8.9). Keyed off their Telegram id.
  router.get('/', async (req, res) => {
    const progress = await deps.progress.listForUser(req.telegramId!);
    res.json({ progress });
  });

  // Incremental save for one topic — called as the student moves through a lesson
  // (after a beat, a check-in, the quiz), not only on exit (§8.9).
  router.put('/:topicId', async (req, res) => {
    const patch = sanitizePatch(req.body);
    if (patch === null) {
      res.status(400).json({ error: 'invalid progress fields' });
      return;
    }
    const record = await deps.progress.upsert(req.telegramId!, req.params.topicId, patch);
    res.json({ progress: record });
  });

  return router;
}
