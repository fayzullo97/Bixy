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
  if (b.retest_round !== undefined) {
    if (typeof b.retest_round !== 'number' || b.retest_round < 0) return null;
    patch.retest_round = b.retest_round;
  }
  // `missed_fingerprints` and `reteach_all_streak` are deliberately NOT accepted
  // from the client — both are derived server-side (see the route), so a client
  // can't hand itself an easier retest or talk Bixy into its patient register.
  return patch;
}

/** Quiz ids the client reports as missed, for the server to fingerprint. */
function missedIds(body: unknown): { ids: number[]; language: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (b.missed_quiz_question_ids === undefined) return null;
  if (!Array.isArray(b.missed_quiz_question_ids)) return null;
  const ids = b.missed_quiz_question_ids.filter((n): n is number => typeof n === 'number');
  return { ids, language: typeof b.language === 'string' ? b.language : 'en' };
}

/**
 * The re-teach streak driving the persona tone shift (Part 05 §8), recomputed
 * from the score the student just posted.
 *
 * Counted on the SCORE, not on the re-teach the board decided to run: §6's
 * second-miss rule also forces a whole-topic re-teach at 50-79%, and those
 * aren't the "below 50%" struggle this trigger is defined against. A pass clears
 * it, so a topic failed again months later starts from zero rather than
 * inheriting a long-resolved streak — the same reasoning §6 applies to
 * `retest_round`.
 */
export function nextReteachStreak(previous: number, scorePct: number): number {
  if (scorePct >= 80) return 0;
  if (scorePct < 50) return previous + 1;
  return previous;
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
    // A reported score moves the tone-shift streak (Part 05 §8). Read the
    // previous value here rather than taking one from the client.
    if (typeof patch.quiz_score === 'number') {
      const previous = (await deps.progress.listForUser(req.telegramId!)).find(
        (p) => p.topic_id === req.params.topicId,
      );
      patch.reteach_all_streak = nextReteachStreak(
        previous?.reteach_all_streak ?? 0,
        patch.quiz_score,
      );
    }
    // A reported quiz result carries which questions were missed; resolve them
    // to durable fingerprints here rather than trusting client-supplied hashes.
    const missed = missedIds(req.body);
    if (missed) {
      patch.missed_fingerprints = await deps.lessons.fingerprintMissed(
        req.params.topicId,
        missed.language as Parameters<typeof deps.lessons.fingerprintMissed>[1],
        missed.ids,
      );
    }
    const record = await deps.progress.upsert(req.telegramId!, req.params.topicId, patch);
    res.json({ progress: record });
  });

  return router;
}
