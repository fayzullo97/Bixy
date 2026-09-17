import { Router } from 'express';
import type { AppDeps } from '../../deps.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { asTopicLevel } from '../study-plan/plan.js';

/**
 * The level map (Part 07 §9). Read-only: the All Levels grid and each level
 * screen are views onto the plan and progress the student already has — opening
 * a level screen never changes the path, it only shows it.
 */
export function levelsRoutes(deps: AppDeps): Router {
  const router = Router();
  router.use(requireAuth(deps.session));

  // Every tier with its counts, for the All Levels grid.
  router.get('/', async (req, res) => {
    res.json(await deps.levels.getMap(req.telegramId!));
  });

  // One tier's topics in path order, plus where its screen should open.
  router.get('/:level', async (req, res) => {
    const level = asTopicLevel(req.params.level);
    if (!level) {
      res.status(404).json({ error: 'unknown level' });
      return;
    }
    res.json(await deps.levels.getLevel(req.telegramId!, level));
  });

  return router;
}
