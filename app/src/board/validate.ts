import {
  CONTENT_STYLES,
  QUIZ_MAX,
  QUIZ_MIN,
  type Beat,
  type BoardScript,
  type CheckInBeat,
  type DoodleRef,
  type QuizQuestion,
  type QuizQuestionType,
  type SpokenUnit,
  type StoryBeat,
} from './types';

function fail(where: string, message: string): never {
  throw new Error(`board script ${where}: ${message}`);
}

function str(value: unknown, where: string, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(where, `\`${field}\` must be a non-empty string`);
  return value;
}

const LANGUAGES = new Set(['en', 'uz', 'ru']);

/**
 * Reads the TTS step's `speech` array. Tolerant: this is server-filled, never
 * model output, and a clip whose synthesis failed simply has no `audio_url` —
 * the board then falls back to its timer for that unit rather than stalling.
 */
function parseSpeech(raw: unknown, where: string): SpokenUnit[] | undefined {
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) fail(where, '`speech` must be an array');
  return raw.map((u, i) => {
    const at = `${where}.speech[${i}]`;
    if (typeof u !== 'object' || u === null) fail(at, 'must be an object');
    const o = u as Record<string, unknown>;
    if (!LANGUAGES.has(o.language as string)) fail(at, '`language` must be en|uz|ru');
    const nums = (raw: unknown, keys: string[]) =>
      Array.isArray(raw)
        ? raw.filter(
            (x): x is Record<string, unknown> =>
              typeof x === 'object' && x !== null && keys.every((k) => typeof (x as Record<string, unknown>)[k] === 'number'),
          )
        : undefined;
    return {
      text: str(o.text, at, 'text'),
      language: o.language as SpokenUnit['language'],
      audio_url: typeof o.audio_url === 'string' ? o.audio_url : undefined,
      // Timing arrays are server-derived, never model output — a malformed entry
      // is dropped so the board falls back to full-text rather than failing.
      sentences: nums(o.sentences, ['duration_ms', 'start_ms']) as SpokenUnit['sentences'],
      duration_ms: typeof o.duration_ms === 'number' ? o.duration_ms : undefined,
      words: nums(o.words, ['start_ms', 'end_ms']) as SpokenUnit['words'],
    };
  });
}

/** Flavour text (Part 04 §6) — tolerant, since the board falls back to plain
 *  wording rather than failing a lesson over a malformed phrasing list. */
function parseScoreReactions(raw: unknown): BoardScript['score_reactions'] {
  const tier = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '') : [];
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return { reteach_all: tier(r.reteach_all), reteach_missed: tier(r.reteach_missed) };
}

const POSITIONS = new Set(['left', 'center', 'right']);

function parseDoodleRef(raw: unknown, where: string, knownElementIds?: Set<string>): DoodleRef {
  if (typeof raw !== 'object' || raw === null) fail(where, 'doodle must be an object');
  const r = raw as Record<string, unknown>;
  const element_id = str(r.element_id, where, 'element_id');
  if (knownElementIds && !knownElementIds.has(element_id)) {
    fail(where, `element_id "${element_id}" is not in the doodle catalog`);
  }
  if (r.position !== undefined && !POSITIONS.has(r.position as string)) {
    fail(where, `position must be left|center|right (got ${JSON.stringify(r.position)})`);
  }
  if (r.attached_to !== undefined && typeof r.attached_to !== 'string') {
    fail(where, '`attached_to` must be a string element_id');
  }
  if (r.text !== undefined && typeof r.text !== 'string') fail(where, '`text` must be a string');
  return {
    element_id,
    position: r.position as DoodleRef['position'],
    attached_to: r.attached_to as string | undefined,
    text: r.text as string | undefined,
  };
}

function parseBeat(raw: unknown, index: number, knownElementIds?: Set<string>): Beat {
  const where = `beats[${index}]`;
  if (typeof raw !== 'object' || raw === null) fail(where, 'must be an object');
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'number') fail(where, '`id` must be a number');

  if (r.type === 'story_beat') {
    if (!Array.isArray(r.doodles)) fail(where, '`doodles` must be an array');
    const beat: StoryBeat = {
      id: r.id,
      type: 'story_beat',
      narration: str(r.narration, where, 'narration'),
      doodles: r.doodles.map((d, i) => parseDoodleRef(d, `${where}.doodles[${i}]`, knownElementIds)),
      speech: parseSpeech(r.speech, where),
    };
    return beat;
  }

  if (r.type === 'formal_beat') {
    if (r.style === 'check_in_question') {
      if (!Array.isArray(r.options) || r.options.length < 2 || r.options.some((o) => typeof o !== 'string')) {
        fail(where, 'check_in_question needs an `options` array of at least two strings');
      }
      if (typeof r.correct_index !== 'number' || r.correct_index < 0 || r.correct_index >= r.options.length) {
        fail(where, '`correct_index` must index into `options`');
      }
      const beat: CheckInBeat = {
        id: r.id,
        type: 'formal_beat',
        speech: parseSpeech(r.speech, where),
        style: 'check_in_question',
        question: str(r.question, where, 'question'),
        options: r.options as string[],
        correct_index: r.correct_index,
        wrong_answer_reactions: (r.wrong_answer_reactions as Record<string, string>) ?? undefined,
      };
      return beat;
    }

    if (!(CONTENT_STYLES as string[]).includes(r.style as string)) {
      fail(where, `unknown formal style ${JSON.stringify(r.style)}`);
    }

    // One shape per style (Part 01 §1). Each style's required fields are
    // enforced; anything extra is dropped, since the shapes are built explicitly.
    const optional = (field: string) => (r[field] !== undefined ? str(r[field], where, field) : undefined);
    const speech = parseSpeech(r.speech, where);

    switch (r.style) {
      case 'title':
        return { id: r.id, type: 'formal_beat', speech, style: 'title', term: str(r.term, where, 'term') };
      case 'formula':
        return {
          id: r.id,
          type: 'formal_beat',
          speech,
          style: 'formula',
          formula: str(r.formula, where, 'formula'),
          note: optional('note'),
        };
      case 'explanation':
        return { id: r.id, type: 'formal_beat', speech, style: 'explanation', note: str(r.note, where, 'note') };
      case 'example':
        return {
          id: r.id,
          type: 'formal_beat',
          speech,
          style: 'example',
          sentence: str(r.sentence, where, 'sentence'),
          note: optional('note'),
        };
      case 'recap_example':
        return {
          id: r.id,
          type: 'formal_beat',
          speech,
          style: 'recap_example',
          sentence: str(r.sentence, where, 'sentence'),
          emphasis: optional('emphasis'),
          note: optional('note'),
        };
      default:
        return {
          id: r.id,
          type: 'formal_beat',
          speech,
          style: 'common_mistake',
          wrong: str(r.wrong, where, 'wrong'),
          correct: str(r.correct, where, 'correct'),
          note: str(r.note, where, 'note'),
        };
    }
  }

  return fail(where, `unknown beat type ${JSON.stringify(r.type)}`);
}

const QUIZ_TYPES: QuizQuestionType[] = ['multiple_choice', 'true_false', 'fill_in_the_blank'];

function parseQuizQuestion(raw: unknown, index: number, beatIds: Set<number>): QuizQuestion {
  const where = `quiz[${index}]`;
  if (typeof raw !== 'object' || raw === null) fail(where, 'must be an object');
  const r = raw as Record<string, unknown>;
  if (typeof r.quiz_question_id !== 'number') fail(where, '`quiz_question_id` must be a number');
  if (!(QUIZ_TYPES as string[]).includes(r.type as string)) {
    fail(where, `unknown quiz type ${JSON.stringify(r.type)}`);
  }
  if (typeof r.tests_beat_id !== 'number') fail(where, '`tests_beat_id` must be a number');
  if (!beatIds.has(r.tests_beat_id)) {
    fail(where, `tests_beat_id ${r.tests_beat_id} does not reference any beat`);
  }
  const type = r.type as QuizQuestionType;
  const base = {
    quiz_question_id: r.quiz_question_id,
    type,
    question: str(r.question, where, 'question'),
    tests_beat_id: r.tests_beat_id,
  };

  if (type === 'fill_in_the_blank') {
    if (
      !Array.isArray(r.accepted_answers) ||
      r.accepted_answers.length === 0 ||
      r.accepted_answers.some((a) => typeof a !== 'string' || a.trim() === '')
    ) {
      fail(where, 'fill_in_the_blank needs a non-empty `accepted_answers` array of strings');
    }
    return { ...base, accepted_answers: (r.accepted_answers as string[]).map((a) => a.trim()) };
  }

  const options =
    type === 'true_false'
      ? Array.isArray(r.options) && r.options.length === 2
        ? (r.options as string[]).map((o) => String(o).trim())
        : ['True', 'False']
      : (r.options as unknown);
  if (!Array.isArray(options) || options.length < 2 || options.some((o) => typeof o !== 'string')) {
    fail(where, `${type} needs an \`options\` array of at least two strings`);
  }
  if (typeof r.correct_index !== 'number' || r.correct_index < 0 || r.correct_index >= options.length) {
    fail(where, '`correct_index` must index into `options`');
  }
  return { ...base, options: options as string[], correct_index: r.correct_index };
}

function parseQuiz(raw: unknown, beatIds: Set<number>): QuizQuestion[] {
  if (!Array.isArray(raw)) fail('quiz', 'must be an array');
  if (raw.length < QUIZ_MIN || raw.length > QUIZ_MAX) {
    fail('quiz', `must have ${QUIZ_MIN}–${QUIZ_MAX} questions (got ${raw.length})`);
  }
  return raw.map((q, i) => parseQuizQuestion(q, i, beatIds));
}

/**
 * Validates and normalizes a board script (§8.2). When `knownElementIds` is
 * given (the doodle catalog), every story doodle's `element_id` is checked to
 * reference a real catalog entry — the AI arranges from the library, it never
 * invents artwork, so an unknown id is a bug, not a bespoke drawing. A `quiz`,
 * when present, is validated against the beats it tags (§8.4).
 */
export function parseBoardScript(raw: unknown, knownElementIds?: Set<string>): BoardScript {
  if (typeof raw !== 'object' || raw === null) fail('', 'must be an object');
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.beats) || r.beats.length === 0) fail('', '`beats` must be a non-empty array');
  const beats = r.beats.map((b, i) => parseBeat(b, i, knownElementIds));
  const beatIds = new Set(beats.map((b) => b.id));
  return {
    topic_id: str(r.topic_id, '', 'topic_id'),
    level: str(r.level, '', 'level'),
    beats,
    ...(r.quiz !== undefined ? { quiz: parseQuiz(r.quiz, beatIds) } : {}),
    ...(r.quiz_intro !== undefined ? { quiz_intro: str(r.quiz_intro, '', 'quiz_intro') } : {}),
    ...(r.quiz_intro_speech !== undefined
      ? { quiz_intro_speech: parseSpeech(r.quiz_intro_speech, 'quiz_intro') }
      : {}),
    ...(r.score_reactions !== undefined ? { score_reactions: parseScoreReactions(r.score_reactions) } : {}),
  };
}
