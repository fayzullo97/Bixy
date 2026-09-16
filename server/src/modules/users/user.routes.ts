import { Router } from 'express';
import type { AppDeps } from '../../deps.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import { toUserDto } from './user.dto.js';
import { greetingStage } from '../study-plan/greeting.js';
import type { StudentProfile } from '../generation/persona.js';

/** The get-to-know-you questions (Part 05 §7), in the order they're asked. */
const PROFILE_FIELDS: Array<keyof StudentProfile> = [
  'occupation',
  'study_place',
  'hobbies',
  'interests',
  'motivation',
];

/**
 * Pull the answers out of a request body. Every field is optional — the student
 * can skip any question, or the whole conversation — so an empty result is a
 * valid profile, not a bad request. Answers are free text the student wrote, so
 * they're length-capped here rather than trusted; a blank answer is dropped
 * rather than stored as an empty string.
 */
function readProfile(body: unknown): StudentProfile {
  if (typeof body !== 'object' || body === null) return {};
  const answers = (body as Record<string, unknown>).answers;
  if (typeof answers !== 'object' || answers === null) return {};

  const profile: StudentProfile = {};
  for (const field of PROFILE_FIELDS) {
    const value = (answers as Record<string, unknown>)[field];
    if (typeof value !== 'string') continue;
    const trimmed = value.trim().slice(0, 300);
    if (trimmed) profile[field] = trimmed;
  }
  return profile;
}

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

  // Which greeting to show now, and stamp the greeting time (§8.12, Part 05 §7).
  // The board calls this each time the continue-prompt fires: `first_meeting`
  // until Bixy has introduced itself, then `full` the first time a day and
  // `short` ("Welcome back") for repeat visits the same day.
  router.post('/greeting', requireAuth(deps.session), async (req, res) => {
    const user = await deps.users.get(req.telegramId!);
    if (!user) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    const stage = greetingStage(user, new Date());
    // The meeting is not a greeting: stamping it here would make the student's
    // very next arrival — seconds later, once the meeting ends — a same-day
    // repeat, so Bixy would follow "nice to meet you" with "welcome back".
    if (stage !== 'first_meeting') {
      await deps.users.setLastGreetedAt(req.telegramId!, new Date().toISOString());
    }
    res.json({ variant: stage });
  });

  // The student's language choice (Part 07 §12). Asked AFTER the level check,
  // because a C1 placement skips the question entirely — English is already that
  // tier's language (Part 01 §1) — so it can't be asked at sign-in.
  router.put('/language', requireAuth(deps.session), async (req, res) => {
    const language = (req.body as { language?: unknown })?.language;
    if (language !== 'en' && language !== 'uz' && language !== 'ru') {
      res.status(400).json({ error: 'language must be one of en, uz, ru' });
      return;
    }
    await deps.users.setAppLanguage(req.telegramId!, language);
    const user = await deps.users.get(req.telegramId!);
    if (!user) {
      res.status(404).json({ error: 'not_found' });
      return;
    }
    res.json({ user: toUserDto(user) });
  });

  // Close the first meeting (Part 05 §7) — sent when the student finishes the
  // get-to-know-you OR skips it. Both stamp `met_at`, so a skip is a decision the
  // app remembers rather than a question it re-asks on the next visit.
  router.post('/profile', requireAuth(deps.session), async (req, res) => {
    const profile = readProfile(req.body);
    await deps.users.completeMeeting(req.telegramId!, profile, new Date().toISOString());
    res.json({ profile });
  });

  return router;
}
