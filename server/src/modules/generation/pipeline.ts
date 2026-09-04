import type { SupabaseClient } from '@supabase/supabase-js';
import type { MessagesClient } from './anthropic.js';
import type { ContentRepo } from '../content/content.repo.js';
import type { LessonCacheRepo } from './lessonCache.repo.js';
import type { TtsClient } from '../tts/client.js';
import type { BoardScript } from './boardScript.js';
import type { Language } from './systemPrompt.js';
import { generateLesson } from './generateLesson.js';
import { generateReexplanation } from './reexplain.js';
import { identifyTopicFromImage, identifyTopicFromText } from './identifyTopic.js';
import { ensureNarrationBucket, uploadNarration } from '../tts/audioStore.js';
import type { Beat } from './boardScript.js';

type ImageInput = { base64: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' };

export interface LessonRequest {
  topicId?: string;
  text?: string;
  image?: ImageInput;
  language: Language;
  source?: string;
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
}

export type AskResponse =
  | { kind: 'lesson'; topicId: string; boardScript: BoardScript; cached: boolean }
  | { kind: 'reexplain'; beats: Beat[] }
  | { kind: 'no_content' };

export interface LessonService {
  getLesson(request: LessonRequest): Promise<LessonResponse>;
  ask(request: AskRequest): Promise<AskResponse>;
}

export interface PipelineDeps {
  anthropic: MessagesClient;
  models: { generation: string; topicId: string };
  content: ContentRepo;
  cache: LessonCacheRepo;
  tts: TtsClient;
  db: SupabaseClient;
}

/** How many times a lesson regenerates trying to produce complete narration audio
 *  before giving up and failing loudly (§8.10), rather than serving a half-silent
 *  lesson or caching one. */
const MAX_AUDIO_ATTEMPTS = 2;

/** True when every story beat that has narration also carries its `audio_url` —
 *  the gate for caching or serving a lesson when TTS is enabled (§9.2). */
export function narrationComplete(script: BoardScript): boolean {
  return script.beats.every(
    (b) => b.type !== 'story_beat' || b.narration.trim() === '' || Boolean(b.audio_url),
  );
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
    for (const beat of script.beats) {
      if (beat.type === 'story_beat' && beat.narration.trim()) {
        try {
          const wav = await deps.tts.synthesize(beat.narration, language);
          const path = `${topicId}/${language}/${source}/beat_${beat.id}.wav`;
          beat.audio_url = await uploadNarration(deps.db, path, wav);
        } catch (error) {
          console.error(`[tts] beat ${beat.id} failed:`, (error as Error).message);
        }
      }
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
   */
  async function serveLesson(
    topicId: string,
    source: string,
    language: Language,
  ): Promise<{ boardScript: BoardScript; cached: boolean } | null> {
    const cached = await deps.cache.get(topicId, source, language);
    if (cached && narrationComplete(cached)) return { boardScript: cached, cached: true };

    const topic = await deps.content.getTopic(topicId);
    if (!topic) return null;
    const doodles = await deps.content.listDoodles();

    let lastError = '';
    for (let attempt = 1; attempt <= MAX_AUDIO_ATTEMPTS; attempt++) {
      const { script } = await generateLesson(
        { anthropic: deps.anthropic, model: deps.models.generation, doodles },
        { topic, language },
      );
      await synthesizeNarration(script, topicId, source, language);

      if (!deps.tts.enabled) {
        // Audio can't be produced without a key — serve, but never cache an
        // audioless result (it would poison future requests once TTS is on).
        return { boardScript: script, cached: false };
      }
      if (narrationComplete(script)) {
        await deps.cache.put(topicId, source, language, script, deps.models.generation);
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
      const lesson = await serveLesson(topicId, source, request.language);
      return lesson ? { ok: true, ...lesson } : { ok: false, error: 'not_found' };
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
        const lesson = await serveLesson(topicId, source, request.language);
        return lesson ? { kind: 'lesson', topicId, ...lesson } : { kind: 'no_content' };
      }

      const text = request.text?.trim();
      if (!text) return { kind: 'no_content' };

      // Text: a different topic is a detour; the same topic (or a question that
      // matches no topic while a lesson is open) is a follow-up on the current one.
      const topicId = await resolveTopicId({ text, language: request.language });
      if (topicId && topicId !== request.currentTopicId) {
        const lesson = await serveLesson(topicId, source, request.language);
        return lesson ? { kind: 'lesson', topicId, ...lesson } : { kind: 'no_content' };
      }

      const currentId = request.currentTopicId ?? topicId ?? null;
      if (!currentId) return { kind: 'no_content' };
      const topic = await deps.content.getTopic(currentId);
      if (!topic) return { kind: 'no_content' };

      const doodles = await deps.content.listDoodles();
      const { beats } = await generateReexplanation(
        { anthropic: deps.anthropic, model: deps.models.generation, doodles },
        { topic, language: request.language, question: text },
      );
      return { kind: 'reexplain', beats };
    },
  };
}
