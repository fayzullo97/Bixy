import { Router } from 'express';
import type { AppDeps } from '../../deps';
import { requireAuth } from '../../middleware/requireAuth';

/**
 * Study plan (§8.12). The path is computed server-side when the level check
 * places the student (see level-check routes); these endpoints serve it and
 * advance the stored position. No browsing or reordering control — the client
 * only ever reads the next topic and reports when one is cleared.
 */
export function studyPlanRoutes(deps: AppDeps): Router {
  const router = Router();
  router.use(requireAuth(deps.session));

  // The student's plan + the topic to serve next + the dashboard stat. `plan`
  // is null when they haven't been placed yet (client routes them to §8.11).
  router.get('/', async (req, res) => {
    const plan = await deps.studyPlan.getForUser(req.telegramId!);
    res.json({ plan });
  });

  // Advance the path after clearing a topic (§8.12). A pass of anything other
  // than the current path topic (a detour) is accepted but doesn't move the path.
  router.post('/advance', async (req, res) => {
    const topicId = (req.body as { topic_id?: unknown })?.topic_id;
    if (typeof topicId !== 'string' || topicId.trim() === '') {
      res.status(400).json({ error: 'topic_id is required' });
      return;
    }
    const plan = await deps.studyPlan.advance(req.telegramId!, topicId);
    if (!plan) {
      res.status(404).json({ error: 'no study plan' });
      return;
    }
    res.json({ plan });
  });

  return router;
}
