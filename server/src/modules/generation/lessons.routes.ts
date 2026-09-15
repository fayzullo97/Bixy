import { Router } from 'express';
import type { AppDeps } from '../../deps.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import type { Language } from './systemPrompt.js';

const LANGUAGES: readonly Language[] = ['en', 'uz', 'ru'];

function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function lessonsRoutes(deps: AppDeps): Router {
  const router = Router();

  // Generate (or serve from cache) a lesson. Authed — generation costs money.
  router.post('/', requireAuth(deps.session), async (req, res) => {
    const body = req.body ?? {};
    if (!isLanguage(body.language)) {
      res.status(400).json({ error: 'language (en|uz|ru) is required' });
      return;
    }
    if (!body.topic_id && !body.text && !body.image) {
      res.status(400).json({ error: 'one of topic_id, text, or image is required' });
      return;
    }

    const result = await deps.lessons.getLesson({
      topicId: typeof body.topic_id === 'string' ? body.topic_id : undefined,
      text: typeof body.text === 'string' ? body.text : undefined,
      image: body.image,
      language: body.language,
      source: typeof body.source === 'string' ? body.source : undefined,
    });

    if (!result.ok) {
      // §8.1: off-topic / unreadable — say so plainly, don't guess.
      res.status(404).json({ error: 'no_content', message: "I don't have information about that." });
      return;
    }
    res.json({ board_script: result.boardScript, cached: result.cached });
  });

  // The single input (§8.5): a typed request or a photo, resolved against the
  // current lesson → a new lesson (detour / photo topic), an appended
  // re-explanation, or no_content. Returns 200 for all three — no_content is a
  // valid answer to surface plainly, not an error.
  router.post('/ask', requireAuth(deps.session), async (req, res) => {
    const body = req.body ?? {};
    if (!isLanguage(body.language)) {
      res.status(400).json({ error: 'language (en|uz|ru) is required' });
      return;
    }
    if (!body.text && !body.image) {
      res.status(400).json({ error: 'one of text or image is required' });
      return;
    }

    const result = await deps.lessons.ask({
      text: typeof body.text === 'string' ? body.text : undefined,
      image: body.image,
      language: body.language,
      currentTopicId: typeof body.current_topic_id === 'string' ? body.current_topic_id : null,
      source: typeof body.source === 'string' ? body.source : undefined,
    });

    if (result.kind === 'lesson') {
      res.json({ kind: 'lesson', topic_id: result.topicId, board_script: result.boardScript, cached: result.cached });
    } else if (result.kind === 'reexplain') {
      res.json({ kind: 'reexplain', beats: result.beats });
    } else {
      res.json({ kind: 'no_content' });
    }
  });

  // The shorter retest after a failed topic test (Part 04 §6). The missed set
  // comes from the student's own progress row — persisted as fingerprints so it
  // survives a re-teach cycle that spans a session boundary — not from the
  // request body, which a client could otherwise use to pick its own retest.
  router.post('/retest', requireAuth(deps.session), async (req, res) => {
    const body = req.body ?? {};
    if (!isLanguage(body.language)) {
      res.status(400).json({ error: 'language (en|uz|ru) is required' });
      return;
    }
    if (typeof body.topic_id !== 'string' || !body.topic_id) {
      res.status(400).json({ error: 'topic_id is required' });
      return;
    }

    const record = (await deps.progress.listForUser(req.telegramId!)).find(
      (p) => p.topic_id === body.topic_id,
    );
    const quiz = await deps.lessons.getRetest({
      topicId: body.topic_id,
      language: body.language,
      missedFingerprints: record?.missed_fingerprints ?? [],
    });

    // An empty retest means nothing is stored for this topic yet — surface it
    // plainly so the board can fall back to the full test rather than showing
    // the student a zero-question quiz.
    res.json({ quiz, retest_round: record?.retest_round ?? 0 });
  });

  // The check-in that closes out a detour (Part 04 §13). Each call rotates past
  // what it last served, so a wrong answer re-asks and gets a different question.
  router.post('/wrap-up', requireAuth(deps.session), async (req, res) => {
    const body = req.body ?? {};
    if (!isLanguage(body.language)) {
      res.status(400).json({ error: 'language (en|uz|ru) is required' });
      return;
    }
    if (typeof body.topic_id !== 'string' || !body.topic_id) {
      res.status(400).json({ error: 'topic_id is required' });
      return;
    }
    const question = await deps.lessons.getDetourWrapUp(body.topic_id, body.language);
    // 200 with a null question: nothing pooled yet is a normal state, not an
    // error — the board returns to the plan without a check-in.
    res.json({ question });
  });

  return router;
}
