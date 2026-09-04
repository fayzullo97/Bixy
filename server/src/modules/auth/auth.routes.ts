import { Router } from 'express';
import type { AppDeps } from '../../deps';
import { requireAuth } from '../../middleware/requireAuth';
import { toUserDto } from '../users/user.dto';
import type { AppLanguage } from '../users/users.repo';

const LANGUAGES: readonly AppLanguage[] = ['en', 'uz', 'ru'];

function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function authRoutes(deps: AppDeps): Router {
  const router = Router();

  // Exchange a Telegram id_token (+ chosen app language) for a first-party session.
  router.post('/telegram', async (req, res) => {
    const idToken = req.body?.id_token as unknown;
    const appLanguage = req.body?.app_language as unknown;

    if (typeof idToken !== 'string' || !isAppLanguage(appLanguage)) {
      res
        .status(400)
        .json({ error: 'id_token (string) and app_language (en|uz|ru) are required' });
      return;
    }

    let profile;
    try {
      profile = await deps.verifyIdToken(idToken);
    } catch {
      // Any validation failure (bad signature, wrong issuer/audience, expired,
      // disallowed alg) collapses to a single opaque 401 — never trust the token.
      res.status(401).json({ error: 'invalid_id_token' });
      return;
    }

    const user = await deps.users.upsert({ ...profile, appLanguage });
    const session = await deps.session.issue(user.telegram_id);
    res.json({ session, user: toUserDto(user) });
  });

  // Explicit sign-out. Stateless session ⇒ the client discards its token; this
  // endpoint exists so sign-out is a real, intentional action and deliberately
  // touches no progress rows (§8.9 — signing out never deletes saved progress).
  router.post('/signout', requireAuth(deps.session), (_req, res) => {
    res.json({ ok: true });
  });

  return router;
}
