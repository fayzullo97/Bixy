import { Router } from 'express';
import type { AppDeps } from '../../deps.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import type { Language } from './systemPrompt.js';
import { isPatient, type PersonaContext } from './persona.js';

const LANGUAGES: readonly Language[] = ['en', 'uz', 'ru'];

function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

/**
 * The per-student persona inputs for one request (Part 05 §8): what the student
 * told Bixy when they met, and whether they've struggled enough on THIS topic to
 * earn the patient register.
 *
 * Assembled in the route, from the student's own stored rows — never from the
 * request body. Patience is a tone a student earns by failing; a client that
 * could ask for it could also ask for it on behalf of someone breezing through.
 *
 * Best-effort: a failed lookup yields the default persona rather than failing the
 * lesson. Tone is an enhancement; the lesson is the product.
 */
async function personaFor(deps: AppDeps, telegramId: string, topicId: string | null): Promise<PersonaContext> {
  try {
    const [user, progress] = await Promise.all([
      deps.users.get(telegramId),
      topicId ? deps.progress.listForUser(telegramId) : Promise.resolve([]),
    ]);
    const record = topicId ? progress.find((p) => p.topic_id === topicId) : undefined;
    return {
      patient: isPatient(record?.reteach_all_streak ?? 0),
      profile: user?.student_profile ?? {},
    };
  } catch (error) {
    console.error('[persona] lookup failed:', (error as Error).message);
    return { patient: false, profile: {} };
  }
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

    const topicId = typeof body.topic_id === 'string' ? body.topic_id : undefined;
    const result = await deps.lessons.getLesson({
      topicId,
      text: typeof body.text === 'string' ? body.text : undefined,
      image: body.image,
      language: body.language,
      source: typeof body.source === 'string' ? body.source : undefined,
      // Keyed on the requested topic — the only one whose struggle history is
      // knowable before the pipeline resolves free text to an id.
      persona: await personaFor(deps, req.telegramId!, topicId ?? null),
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

    const currentTopicId = typeof body.current_topic_id === 'string' ? body.current_topic_id : null;
    const result = await deps.lessons.ask({
      text: typeof body.text === 'string' ? body.text : undefined,
      image: body.image,
      language: body.language,
      currentTopicId,
      source: typeof body.source === 'string' ? body.source : undefined,
      persona: await personaFor(deps, req.telegramId!, currentTopicId),
    });

    if (result.kind === 'lesson') {
      res.json({ kind: 'lesson', topic_id: result.topicId, board_script: result.boardScript, cached: result.cached });
    } else if (result.kind === 'reexplain') {
      res.json({ kind: 'reexplain', beats: result.beats });
    } else if (result.kind === 'identity') {
      res.json({ kind: 'identity', text: result.text });
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
