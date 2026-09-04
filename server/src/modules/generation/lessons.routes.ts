import { Router } from 'express';
import type { AppDeps } from '../../deps';
import { requireAuth } from '../../middleware/requireAuth';
import type { Language } from './systemPrompt';

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

  return router;
}
