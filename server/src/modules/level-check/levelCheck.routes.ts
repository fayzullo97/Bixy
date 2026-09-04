import { Router } from 'express';
import type { AppDeps } from '../../deps.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { TOPIC_LEVELS } from '../content/topic.js';

/**
 * Level check (§8.11). The adaptive algorithm itself runs client-side (a pure
 * module, like mastery §8.4); the server owns the question bank, the per-student
 * seen-tracking that "prefer unseen" reads, and the persisted placement.
 * Grading reuses POST /assessment/grade — no grader lives here.
 */
export function levelCheckRoutes(deps: AppDeps): Router {
  const router = Router();
  router.use(requireAuth(deps.session));

  // Everything the client needs to start (or retake) the level check: the full
  // bank, this student's already-seen question ids, and their current placement.
  router.get('/', async (req, res) => {
    const [questions, seen, placement] = await Promise.all([
      deps.levelCheck.listQuestions(),
      deps.levelCheck.listSeen(req.telegramId!),
      deps.levelCheck.getPlacement(req.telegramId!),
    ]);
    res.json({ questions, seen, placement });
  });

  // Record that a question was shown to this student (§8.11 Retaking). Best-effort
  // from the client's side; a failure must never block the test.
  router.post('/seen', async (req, res) => {
    const questionId = (req.body as { question_id?: unknown })?.question_id;
    if (typeof questionId !== 'string' || questionId.trim() === '') {
      res.status(400).json({ error: 'question_id is required' });
      return;
    }
    await deps.levelCheck.markSeen(req.telegramId!, questionId);
    res.json({ ok: true });
  });

  // Persist the placement a completed attempt landed on. Overwrites on a retake.
  // The study plan (§8.12) is (re)built from the placement right here: a retake
  // at a different level rebuilds the path, the same level leaves it untouched.
  router.put('/placement', async (req, res) => {
    const level = (req.body as { level?: unknown })?.level;
    if (typeof level !== 'string' || !(TOPIC_LEVELS as readonly string[]).includes(level)) {
      res.status(400).json({ error: `level must be one of ${TOPIC_LEVELS.join(', ')}` });
      return;
    }
    await deps.levelCheck.setPlacement(req.telegramId!, level);
    await deps.studyPlan.rebuildForPlacement(req.telegramId!, level);
    res.json({ placement: level });
  });

  return router;
}
