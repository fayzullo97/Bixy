import type { SupabaseClient } from '@supabase/supabase-js';
import type { MessagesClient } from './anthropic.js';
import type { ContentRepo } from '../content/content.repo.js';
import type { LessonCacheRepo } from './lessonCache.repo.js';
import type { TtsClient } from '../tts/client.js';
import type { BoardScript, SpokenUnit } from './boardScript.js';
import type { Language } from './systemPrompt.js';
import { generateLesson } from './generateLesson.js';
import { contentLanguage } from './contentLanguage.js';
import { spokenUnits } from './spokenUnits.js';
import type { VariantsRepo } from './variants.repo.js';
import { buildRetest, RETEST_SIZE } from './retest.js';
import { variantFingerprint } from './variants.js';
import { generateReexplanation } from './reexplain.js';
import { identifyTopicFromImage, identifyTopicFromText } from './identifyTopic.js';
import { deflectIdentity, isIdentityQuestion } from './identity.js';
import { personaFragment, type PersonaContext } from './persona.js';
import { ensureNarrationBucket, uploadNarration } from '../tts/audioStore.js';
import { narrate } from '../tts/narrate.js';
import { canAlign, transcribeWords, type TranscribeConfig } from '../tts/transcribe.js';
import { alignToScript, proportionalTiming, scriptWords } from '../tts/align.js';
import type { Beat, QuizQuestion } from './boardScript.js';

type ImageInput = { base64: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' };

export interface LessonRequest {
  topicId?: string;
  text?: string;
  image?: ImageInput;
  language: Language;
  source?: string;
  /** Per-student persona inputs (Part 05 §8). Present but un-triggered is the
   *  normal case and changes nothing, including cacheability. */
  persona?: PersonaContext;
}

export type LessonResponse =
  | { ok: true; boardScript: BoardScript; cached: boolean }
  | { ok: false; error: 'not_found' };

/** A submitted input (§8.5), with the topic the student is currently on (if any). */
export interface AskRequest {
  text?: string;
  image?: ImageInput;
  language: Language;
  currentTopicId?: string | null;
  source?: string;
  persona?: PersonaContext;
}

export type AskResponse =
  | { kind: 'lesson'; topicId: string; boardScript: BoardScript; cached: boolean }
  | { kind: 'reexplain'; beats: Beat[] }
  /** "Are you real?" answered in character (Part 05 §8). */
  | { kind: 'identity'; text: string }
  | { kind: 'no_content' };

/** A shorter re-test after a failed topic test (Part 04 §6). */
export interface RetestRequest {
  topicId: string;
  language: Language;
  /** Fingerprints of what the student missed last time, from their progress row. */
  missedFingerprints: string[];
}

export interface LessonService {
  getLesson(request: LessonRequest): Promise<LessonResponse>;
  ask(request: AskRequest): Promise<AskResponse>;
  getRetest(request: RetestRequest): Promise<QuizQuestion[]>;
  /** One check-in question closing out a detour (Part 04 §13), or null when the
   *  topic's pool has nothing suitable. */
  getDetourWrapUp(topicId: string, language: Language): Promise<QuizQuestion | null>;
  /** Turns quiz ids the client reports as missed into durable fingerprints
   *  (Part 04 §6) — ids are positional within one script, fingerprints aren't. */
  fingerprintMissed(topicId: string, language: Language, quizQuestionIds: number[]): Promise<string[]>;
}

export interface PipelineDeps {
  anthropic: MessagesClient;
  models: { generation: string; topicId: string };
  content: ContentRepo;
  cache: LessonCacheRepo;
  tts: TtsClient;
  db: SupabaseClient;
  /** Word-timing source for the subtitle window (Part 02 §3). Omit to skip
   *  alignment entirely — lessons then show full-text subtitles. */
  transcribe?: TranscribeConfig;
  /** Variant pool (Part 04). Omit to skip harvesting — nothing else changes. */
  variants?: VariantsRepo;
}

/** How many times a lesson regenerates trying to produce complete narration audio
 *  before giving up and failing loudly (§8.10), rather than serving a half-silent
 *  lesson or caching one. */
const MAX_AUDIO_ATTEMPTS = 2;

/**
 * How many narration UNITS to synthesize at once.
 *
 * Note this multiplies: since Part 02 §3 each unit synthesizes its sentences
 * concurrently too, so in-flight TTS requests are roughly this times the average
 * sentences per unit (~2). Measured at 12 with no rate-limit rejections; lower it
 * via the env var if a provider starts returning 429s.
 */
const TTS_CONCURRENCY = Number(process.env.TTS_CONCURRENCY ?? 12);

/**
 * True when every clip the lesson is supposed to speak actually has its audio —
 * the gate for caching or serving a lesson when TTS is enabled (§9.2).
 *
 * Part 02 §5 widened this from story beats to the whole script, so a lesson
 * cached before the formal track was narrated now fails the gate and regenerates
 * on next request. That self-healing is why this change needs no cache version
 * bump: a stale row is treated as a miss, exactly like one cached before TTS
 * existed at all.
 */
export function narrationComplete(script: BoardScript): boolean {
  const done = (units: BoardScript['quiz_intro_speech']) =>
    Array.isArray(units) && units.length > 0 && units.every((u) => Boolean(u.audio_url));

  for (const beat of script.beats) {
    // A beat with nothing to say (e.g. an empty narration) is complete already.
    // The language argument only tags units, never changes how many there are,
    // so any value answers "does this beat speak?" — the script's own language
    // isn't recoverable here and isn't needed.
    if (spokenUnits(beat, 'en').length === 0) continue;
    if (!done(beat.speech)) return false;
  }
  if (script.quiz_intro?.trim() && !done(script.quiz_intro_speech)) return false;
  return true;
}

/**
 * The generation pipeline (§9.2): resolve the topic → serve from the result
 * cache if present (no model/TTS call) → otherwise generate the board script,
 * synthesize per-beat narration, store, and return. Anything off the grammar
 * path resolves to `not_found`, which the route turns into the plain
 * "I don't have information about that" (§8.1).
 */
export function createLessonService(deps: PipelineDeps): LessonService {
  async function resolveTopicId(request: LessonRequest): Promise<string | null> {
    if (request.topicId) return request.topicId;
    const topics = await deps.content.listTopicsCompact();
    const idDeps = { anthropic: deps.anthropic, topics };
    const result = request.image
      ? await identifyTopicFromImage(idDeps, deps.models.topicId, request.image)
      : request.text
        ? await identifyTopicFromText(idDeps, deps.models.generation, request.text)
        : null;
    return result && result.ok ? result.topicId : null;
  }

  /**
   * Synthesize + store per-beat narration, filling in each story beat's
   * `audio_url` in place. Best-effort per beat — a failed beat is logged and left
   * without audio; whether the result is usable is decided by the caller via
   * `narrationComplete`, not a side flag, so an incomplete result can never be
   * mistaken for a finished one.
   */
  async function synthesizeNarration(
    script: BoardScript,
    topicId: string,
    source: string,
    language: Language,
  ): Promise<void> {
    if (!deps.tts.enabled) return;
    try {
      await ensureNarrationBucket(deps.db);
    } catch (error) {
      console.error('[tts] bucket setup failed:', (error as Error).message);
      return;
    }

    /** Synthesizes one unit in place; a failure leaves `audio_url` unset. */
    const speak = async (unit: SpokenUnit, path: string, label: string, subtitled: boolean) => {
      try {
        // Each unit routes by ITS OWN language, not the lesson's — an English
        // `sentence` inside a Russian lesson is voiced by the English provider.
        // `narrate` splits it into per-sentence clips and rejoins them with the
        // 400ms gap (Part 02 §3), returning exact per-sentence timings.
        const result = await narrate(deps.tts, unit.text, unit.language);
        unit.audio_url = await uploadNarration(deps.db, path, result.wav);
        unit.sentences = result.sentences;
        unit.duration_ms = result.duration_ms;

        // Word timings only where a rolling subtitle is actually shown: story
        // narration. Formal text is already written on the board, so a subtitle
        // repeating it would be noise — and skipping it keeps Whisper to a
        // handful of calls per lesson instead of one per unit.
        if (!subtitled || !deps.transcribe || !canAlign(unit.language)) return;
        const words = scriptWords(unit.text);
        const heard = await transcribeWords(deps.transcribe, result.wav, unit.language, unit.text);
        const aligned = heard ? alignToScript(words, heard, result.duration_ms) : null;
        // Reconciliation can fail (Whisper transcribes blindly); proportional
        // timing off the exact per-sentence durations is the bounded fallback.
        unit.words = aligned ?? proportionalTiming(result.sentences);
      } catch (error) {
        console.error(`[tts] ${label} failed:`, (error as Error).message);
      }
    };

    // Collect every clip first, then synthesize them concurrently. Part 02 §5 took
    // a lesson from ~5 narrated beats to ~30 spoken units; run sequentially that
    // is ~120s, which overruns both the client's LESSON_TIMEOUT_MS and the
    // serverless function's ceiling. Each unit is an independent object, so
    // filling them in parallel is safe — order is fixed by the arrays, not by
    // completion order.
    const jobs: Array<{ unit: SpokenUnit; path: string; label: string; subtitled: boolean }> = [];

    for (const beat of script.beats) {
      const units = spokenUnits(beat, language);
      if (units.length === 0) continue;
      beat.speech = units;
      units.forEach((unit, i) =>
        jobs.push({
          unit,
          path: `${topicId}/${language}/${source}/beat_${beat.id}_${i}.wav`,
          label: `beat ${beat.id} unit ${i}`,
          subtitled: beat.type === 'story_beat',
        }),
      );
    }

    if (script.quiz_intro?.trim()) {
      const unit: SpokenUnit = { text: script.quiz_intro, language };
      script.quiz_intro_speech = [unit];
      jobs.push({
        unit,
        path: `${topicId}/${language}/${source}/quiz_intro_0.wav`,
        label: 'quiz_intro',
        subtitled: false,
      });
    }

    let next = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++]!;
        await speak(job.unit, job.path, job.label, job.subtitled);
      }
    };
    await Promise.all(Array.from({ length: Math.min(TTS_CONCURRENCY, jobs.length) }, worker));
  }

  /**
   * Tops up a topic's quiz-question pool from a freshly generated lesson (Part
   * 04 §6). Every regeneration — a cache miss, a rule_version bump, another
   * student on the same topic — contributes, so the pool deepens over time
   * without anything being generated purely to fill it.
   *
   * Best-effort: the pool is an enhancement, so a failure here is logged and the
   * lesson still serves. It must never be the reason a student can't learn.
   */
  async function harvestQuiz(topicId: string, language: Language, script: BoardScript): Promise<void> {
    if (!deps.variants || !script.quiz?.length) return;
    try {
      const added = await deps.variants.put(topicId, language, 'quiz_question', script.quiz);
      if (added > 0) console.log(`[variants] +${added} quiz question(s) for ${topicId}/${language}`);
    } catch (error) {
      console.error('[variants] quiz harvest failed:', (error as Error).message);
    }
  }

  /** Same, for an alternate explanation produced by a follow-up (Part 04 §13). */
  async function harvestSegment(topicId: string, language: Language, beats: Beat[]): Promise<void> {
    if (!deps.variants || beats.length === 0) return;
    try {
      await deps.variants.put(topicId, language, 'reexplain_segment', [{ beats }]);
    } catch (error) {
      console.error('[variants] segment harvest failed:', (error as Error).message);
    }
  }

  /**
   * Serve one lesson by resolved topic id (§9.2). A result-cache hit is honoured
   * only if it's audio-complete — a silently-degraded row (e.g. cached before TTS
   * was available) is treated as a miss and regenerated, never served as-is.
   * Otherwise: generate + synthesize narration; when TTS is enabled we require
   * EVERY narration beat to have its audio_url before caching or serving — a miss
   * regenerates and retries, and exhausting the budget throws rather than serving
   * a half-silent lesson (§8.10, no silent fallback). Returns null for an unknown
   * topic. With no TTS key, audio isn't expected: serve, but never cache.
   *
   * The topic is resolved BEFORE the cache lookup because the level gate (Part 01
   * §1) needs its CEFR tier: the cache is keyed by the EFFECTIVE content language,
   * so a C1 topic asked for in en/uz/ru shares one English row instead of three.
   *
   * Part 05 §8: a lesson written for ONE student — the patient re-teach — is
   * neither read from nor written to that shared cache. The cache is keyed by
   * topic/source/language/rule_version with no student in it, so caching a
   * personalized lesson would serve one student's re-teach to everyone else, and
   * reading from it would hand the struggling student back the very explanation
   * that already didn't land. Un-triggered is the overwhelmingly common case and
   * leaves caching exactly as it was.
   */
  async function serveLesson(
    topicId: string,
    source: string,
    requestedLanguage: Language,
    persona?: PersonaContext,
  ): Promise<{ boardScript: BoardScript; cached: boolean } | null> {
    const topic = await deps.content.getTopic(topicId);
    if (!topic) return null;
    const language = contentLanguage(topic.level, requestedLanguage);

    // Only the patient register personalizes a LESSON. The student profile alone
    // doesn't: it would take every student off the shared cache permanently, for
    // flavour, on the most expensive call in the product. The profile still
    // colours the surfaces that are already per-request — a re-explanation, an
    // identity deflection — and rides along here once patience has already
    // pulled this generation out of the cache.
    const fragment = persona?.patient ? personaFragment(persona) : '';
    const personalized = fragment !== '';

    if (!personalized) {
      const cached = await deps.cache.get(topicId, source, language);
      if (cached && narrationComplete(cached)) return { boardScript: cached, cached: true };
    }

    const doodles = await deps.content.listDoodles();

    let lastError = '';
    for (let attempt = 1; attempt <= MAX_AUDIO_ATTEMPTS; attempt++) {
      const { script } = await generateLesson(
        { anthropic: deps.anthropic, model: deps.models.generation, doodles },
        { topic, language, persona: fragment },
      );
      await synthesizeNarration(script, topicId, source, language);

      if (!deps.tts.enabled) {
        // Audio can't be produced without a key — serve, but never cache an
        // audioless result (it would poison future requests once TTS is on).
        await harvestQuiz(topicId, language, script);
        return { boardScript: script, cached: false };
      }
      if (narrationComplete(script)) {
        if (!personalized) await deps.cache.put(topicId, source, language, script, deps.models.generation);
        // Harvested either way: the QUESTIONS in a personalized lesson still test
        // the same topic, so they're as reusable to the pool as any other run's.
        await harvestQuiz(topicId, language, script);
        return { boardScript: script, cached: false };
      }
      lastError = 'a narration beat was left without audio';
    }
    throw new Error(`lesson audio incomplete after ${MAX_AUDIO_ATTEMPTS} attempts for ${topicId}/${language}: ${lastError}`);
  }

  return {
    async getLesson(request) {
      const source = request.source ?? 'reference_material';
      const topicId = await resolveTopicId(request);
      if (!topicId) return { ok: false, error: 'not_found' };
      const lesson = await serveLesson(topicId, source, request.language, request.persona);
      return lesson ? { ok: true, ...lesson } : { ok: false, error: 'not_found' };
    },

    /**
     * Picks the question that closes out a detour (Part 04 §13).
     *
     * Drawn from the topic's variant pool and marked used on the way out, so a
     * wrong answer simply asks again and the rotation hands back a DIFFERENT
     * question — that's the "retries with a new variant" behaviour, with no
     * separate retry system behind it.
     *
     * Multiple-choice and true/false only: this has to read as a check-in, and a
     * check-in is tapped, not typed. A fill-in-the-blank would also need the
     * grader, which is more machinery than a wrap-up warrants.
     *
     * Null when nothing suitable is pooled — the board then returns to the plan
     * without a check-in rather than blocking on flavour.
     */
    async getDetourWrapUp(topicId, language) {
      if (!deps.variants) return null;
      const topic = await deps.content.getTopic(topicId);
      if (!topic) return null;
      const effective = contentLanguage(topic.level, language);

      try {
        // Over-fetch: the pool is mixed, and the least-used rows might all be
        // fill-in-the-blank. Ask for a handful and take the first tappable one.
        const rows = await deps.variants.take<QuizQuestion>(topicId, effective, 'quiz_question', 8);
        const row = rows.find(
          (r) =>
            (r.payload.type === 'multiple_choice' || r.payload.type === 'true_false') &&
            (r.payload.options?.length ?? 0) >= 2,
        );
        if (!row) return null;
        // AWAITED, unlike the retest's bookkeeping: here the rotation IS the
        // retry mechanism, so the next call must see this one recorded. Verified
        // live — fire-and-forget let a fast second call race ahead of the write
        // and hand back the same question, which is exactly what asking again is
        // supposed to avoid.
        try {
          await deps.variants.markUsed([row.id]);
        } catch (error) {
          console.error('[variants] wrap-up markUsed failed:', (error as Error).message);
        }
        return { ...row.payload, quiz_question_id: 1 };
      } catch (error) {
        console.error('[variants] wrap-up fetch failed:', (error as Error).message);
        return null;
      }
    },

    /**
     * Maps quiz ids to content fingerprints (Part 04 §6).
     *
     * The client knows which questions it just showed, but a `quiz_question_id`
     * is positional within one generated script and shifts on regeneration — so
     * it's resolved against the cached script here and stored as a content hash
     * instead. Unknown ids drop out rather than erroring: a stale client should
     * lose a question from its retest, not fail to record the attempt.
     */
    async fingerprintMissed(topicId, language, quizQuestionIds) {
      const topic = await deps.content.getTopic(topicId);
      if (!topic) return [];
      const effective = contentLanguage(topic.level, language);
      const cached = await deps.cache.get(topicId, 'reference_material', effective);
      if (!cached?.quiz) return [];
      const wanted = new Set(quizQuestionIds);
      return cached.quiz
        .filter((q) => wanted.has(q.quiz_question_id))
        .map((q) => variantFingerprint('quiz_question', q));
    },

    /**
     * Assembles the 8-question retest (Part 04 §6): the student's missed
     * questions first, topped up from the topic's variant pool.
     *
     * Reads the topic's own cached lesson for the missed questions themselves —
     * `missedFingerprints` identifies them, but the question bodies live in the
     * script and the pool. Harvests that quiz first so a lesson generated before
     * the pool existed still yields a usable retest instead of an empty one.
     *
     * Never generates: §6 is explicit that a retest draws on stored material, so
     * a thin pool produces a shorter retest rather than a model call.
     */
    async getRetest(request) {
      const source = 'reference_material';
      const topic = await deps.content.getTopic(request.topicId);
      if (!topic) return [];
      const language = contentLanguage(topic.level, request.language);

      const cached = await deps.cache.get(request.topicId, source, language);
      const available = cached?.quiz ?? [];
      if (available.length > 0) await harvestQuiz(request.topicId, language, cached!);

      let pooled: QuizQuestion[] = [];
      let pooledIds: number[] = [];
      if (deps.variants) {
        try {
          // Exclude both the missed set (already placed first) and everything in
          // the current script, so the pool contributes genuinely new material
          // before we fall back to repeating this attempt's questions.
          const exclude = [
            ...request.missedFingerprints,
            ...available.map((q) => variantFingerprint('quiz_question', q)),
          ];
          const rows = await deps.variants.take<QuizQuestion>(
            request.topicId,
            language,
            'quiz_question',
            RETEST_SIZE,
            exclude,
          );
          pooled = rows.map((r) => r.payload);
          pooledIds = rows.map((r) => r.id);
        } catch (error) {
          console.error('[variants] retest fetch failed:', (error as Error).message);
        }
      }

      const quiz = buildRetest(request.missedFingerprints, available, pooled);
      if (deps.variants && pooledIds.length > 0) {
        // Advance rotation so a second failure on this topic pulls different
        // filler. Best-effort — a failed bookkeeping write must not cost the
        // student their retest.
        deps.variants.markUsed(pooledIds).catch((error) => {
          console.error('[variants] markUsed failed:', (error as Error).message);
        });
      }
      return quiz;
    },

    async ask(request) {
      const source = request.source ?? 'reference_material';

      // A photo is always "which topic is this?" → serve that lesson (a detour).
      if (request.image) {
        let topicId: string | null;
        try {
          topicId = await resolveTopicId({ image: request.image, language: request.language });
        } catch {
          // An unreadable/invalid image can make the vision model reject the
          // request outright (§10) — surface it as plain "no content", not a 500.
          return { kind: 'no_content' };
        }
        if (!topicId) return { kind: 'no_content' };
        const lesson = await serveLesson(topicId, source, request.language, request.persona);
        return lesson ? { kind: 'lesson', topicId, ...lesson } : { kind: 'no_content' };
      }

      const text = request.text?.trim();
      if (!text) return { kind: 'no_content' };

      // "Are you real?" is answered FIRST (Part 05 §8) — before topic matching
      // and before the no-lesson-open fallback, so it lands the same way whether
      // or not a lesson is on the board. Downstream it has nowhere good to go:
      // it matches no topic, so with a lesson open it becomes a re-explanation of
      // something the student didn't ask about, and without one it becomes "I
      // don't have information about that" — the tutor appearing to dodge the
      // question, which is the opposite of the persona's answer to it.
      if (await isIdentityQuestion(deps.anthropic, deps.models.generation, text)) {
        return {
          kind: 'identity',
          text: await deflectIdentity(deps.anthropic, deps.models.generation, text, request.language),
        };
      }

      // Text: a different topic is a detour; the same topic (or a question that
      // matches no topic while a lesson is open) is a follow-up on the current one.
      const topicId = await resolveTopicId({ text, language: request.language });
      if (topicId && topicId !== request.currentTopicId) {
        const lesson = await serveLesson(topicId, source, request.language, request.persona);
        return lesson ? { kind: 'lesson', topicId, ...lesson } : { kind: 'no_content' };
      }

      const currentId = request.currentTopicId ?? topicId ?? null;
      if (!currentId) return { kind: 'no_content' };
      const topic = await deps.content.getTopic(currentId);
      if (!topic) return { kind: 'no_content' };

      const doodles = await deps.content.listDoodles();
      const effective = contentLanguage(topic.level, request.language);
      const { beats } = await generateReexplanation(
        { anthropic: deps.anthropic, model: deps.models.generation, doodles },
        // Same level gate as a lesson — a C1 follow-up stays fully English.
        // A re-explanation is generated per request and never cached, so the
        // student's own profile colours it even when patience hasn't triggered.
        {
          topic,
          language: effective,
          question: text,
          persona: request.persona ? personaFragment(request.persona) : '',
        },
      );
      // An alternate explanation is exactly what the pool is for: the next
      // student who stumbles here can be shown this instead of a repeat.
      await harvestSegment(currentId, effective, beats);
      return { kind: 'reexplain', beats };
    },
  };
}
