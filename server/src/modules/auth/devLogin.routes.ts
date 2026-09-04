import { Router } from 'express';
import type { AppDeps } from '../../deps';
import { toUserDto } from '../users/user.dto';
import type { AppLanguage } from '../users/users.repo';

const LANGUAGES: readonly AppLanguage[] = ['en', 'uz', 'ru'];

function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * DEV-ONLY sign-in. Skips Telegram id_token validation entirely and mints a
 * session for a fake identity. It exists so the app can be run and verified
 * locally before the production URL is registered with BotFather — real Telegram
 * login cannot complete until that registration exists.
 *
 * Only mounted when ALLOW_DEV_LOGIN is on, which env.ts force-disables when
 * NODE_ENV === 'production'. This must never be reachable in a deployed app.
 */
export function devLoginRoutes(deps: AppDeps): Router {
  const router = Router();

  router.post('/', async (req, res) => {
    const appLanguage = isAppLanguage(req.body?.app_language) ? req.body.app_language : 'en';
    const telegramId =
      typeof req.body?.telegram_id === 'string' && req.body.telegram_id
        ? req.body.telegram_id
        : 'dev-1';
    const name = typeof req.body?.name === 'string' ? req.body.name : 'Dev Student';

    const user = await deps.users.upsert({
      telegramId,
      name,
      username: 'dev',
      photoUrl: null,
      appLanguage,
    });
    const session = await deps.session.issue(user.telegram_id);
    res.json({ session, user: toUserDto(user) });
  });

  return router;
}
