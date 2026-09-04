import { Router } from 'express';
import type { AppDeps } from '../../deps.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { toUserDto } from './user.dto.js';
import { greetingVariant } from '../study-plan/greeting.js';

export function userRoutes(deps: AppDeps): Router {
  const router = Router();

  // Who am I? Used by the client on load to restore a persisted session (§8.8).
  router.get('/', requireAuth(deps.session), async (req, res) => {
    const user = await deps.users.get(req.telegramId!);
    if (!user) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ user: toUserDto(user) });
  });

  // Which greeting to show now, and stamp the greeting time (§8.12). The board
  // calls this each time the continue-prompt fires: `full` the first time a day,
  // `short` ("Welcome back") for repeat visits the same day.
  router.post('/greeting', requireAuth(deps.session), async (req, res) => {
    const last = await deps.users.getLastGreetedAt(req.telegramId!);
    const variant = greetingVariant(last, new Date());
    await deps.users.setLastGreetedAt(req.telegramId!, new Date().toISOString());
    res.json({ variant });
  });

  return router;
}
