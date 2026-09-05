import { Router } from 'express';
import type { AppDeps } from '../../deps.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { toUserDto } from '../users/user.dto.js';
import type { AppLanguage } from '../users/users.repo.js';

const LANGUAGES: readonly AppLanguage[] = ['en', 'uz', 'ru'];

function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/** Map Telegram's IETF language tag (e.g. 'ru', 'en-US', 'uz') to a supported app language. */
function languageFromTelegram(code: string | null): AppLanguage {
  const primary = (code ?? '').toLowerCase().split('-')[0];
  return isAppLanguage(primary) ? primary : 'en';
}

export function authRoutes(deps: AppDeps): Router {
  const router = Router();

  // Exchange a verified Telegram Mini App initData string for a first-party session.
  // The Mini App has no login screen, so the app language is normally derived from
  // the Telegram user's language_code; `app_language` is still accepted (optional)
  // for an explicit override, and a returning user's saved language is preserved.
  router.post('/telegram', async (req, res) => {
    const initData = req.body?.init_data as unknown;
    const requestedLanguage = req.body?.app_language as unknown;

    if (typeof initData !== 'string' || initData.length === 0) {
      res.status(400).json({ error: 'init_data (string) is required' });
      return;
    }
    // If a language is explicitly provided it must be valid; absence is fine (derived).
    if (requestedLanguage !== undefined && !isAppLanguage(requestedLanguage)) {
      res.status(400).json({ error: 'app_language must be one of en|uz|ru' });
      return;
    }

    let profile;
    try {
      profile = await deps.verifyInitData(initData);
    } catch {
      // Any validation failure (bad/missing hash, tampering, expired auth_date)
      // collapses to a single opaque 401 — never trust the data.
      res.status(401).json({ error: 'invalid_init_data' });
      return;
    }

    // Language precedence: a returning student's saved choice wins, then an explicit
    // request, then Telegram's own language_code, then English.
    const existing = await deps.users.get(profile.telegramId);
    const appLanguage: AppLanguage =
      existing?.app_language ??
      (isAppLanguage(requestedLanguage)
        ? requestedLanguage
        : languageFromTelegram(profile.languageCode));

    const user = await deps.users.upsert({
      telegramId: profile.telegramId,
      name: profile.name,
      username: profile.username,
      photoUrl: profile.photoUrl,
      appLanguage,
    });
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
