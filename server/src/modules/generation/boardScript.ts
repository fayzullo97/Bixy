// Server-side board-script types + validator (§8.2), ported from the client
// renderer so generated scripts are validated before storage. Adds `audio_url`
// on story beats, populated by the TTS step.

export type DoodlePosition = 'left' | 'center' | 'right';

export interface DoodleRef {
  element_id: string;
  position?: DoodlePosition;
  attached_to?: string;
  text?: string;
}

export interface StoryBeat {
  id: number;
  type: 'story_beat';
  narration: string;
  doodles: DoodleRef[];
  /** Public URL of the synthesized narration WAV (filled in by the TTS step). */
  audio_url?: string;
}

export type ContentStyle =
  | 'title'
  | 'formula'
  | 'explanation'
  | 'example'
  | 'common_mistake'
  | 'recap_example';

export interface ContentFormalBeat {
  id: number;
  type: 'formal_beat';
  style: ContentStyle;
  content: string;
  emphasis?: string;
}

export interface CheckInBeat {
  id: number;
  type: 'formal_beat';
  style: 'check_in_question';
  question: string;
  options: string[];
  correct_index: number;
  wrong_answer_reactions?: Record<string, string>;
}

export type FormalBeat = ContentFormalBeat | CheckInBeat;
export type Beat = StoryBeat | FormalBeat;

// End-of-topic test (§8.4). Blended question types, each tagged to the beat it
// tests so a partial-mastery result can re-teach only the missed concepts. MC and
// TF carry `options` + `correct_index`; fill-in-the-blank carries an
// `accepted_answers` list graded by the §8.11 grader (deterministic, AI fallback).
export type QuizQuestionType = 'multiple_choice' | 'true_false' | 'fill_in_the_blank';

export interface QuizQuestion {
  quiz_question_id: number;
  type: QuizQuestionType;
  question: string;
  /** MC/TF choices. TF is normalized to ['True','False']. Absent for fill-in-the-blank. */
  options?: string[];
  /** MC/TF: index of the correct option. Absent for fill-in-the-blank. */
  correct_index?: number;
  /** Fill-in-the-blank: predefined accepted answers, checked before the AI fallback (§8.11). */
  accepted_answers?: string[];
  /** The beat this question tests (§8.4) — drives missed-concept re-teach. */
  tests_beat_id: number;
}

export interface BoardScript {
  topic_id: string;
  level: string;
  beats: Beat[];
  /** The end-of-topic test (§8.4). Optional in the reader (a legacy/quiz-less
   *  script still renders); generation asserts it separately. */
  quiz?: QuizQuestion[];
}

/** How many questions the end-of-topic test must have (§8.4, scaling with complexity). */
export const QUIZ_MIN = 10;
export const QUIZ_MAX = 15;

export const CONTENT_STYLES: ContentStyle[] = [
  'title',
  'formula',
  'explanation',
  'example',
  'common_mistake',
  'recap_example',
];

function fail(where: string, message: string): never {
  throw new Error(`board script ${where}: ${message}`);
}

function str(value: unknown, where: string, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') fail(where, `\`${field}\` must be a non-empty string`);
  return value;
}

/** Like str(), but collapses whitespace runs to single spaces — models sometimes
 *  pad a line with a stray newline + a long run of spaces, which would render as
 *  a huge blank on the board. Used for display text (not ids/slugs). */
function text(value: unknown, where: string, field: string): string {
  return str(value, where, field).replace(/\s+/g, ' ').trim();
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
    position: r.position as DoodlePosition | undefined,
    attached_to: r.attached_to as string | undefined,
    text: typeof r.text === 'string' ? r.text.replace(/\s+/g, ' ').trim() : undefined,
  };
}

function parseBeat(raw: unknown, index: number, knownElementIds?: Set<string>): Beat {
  const where = `beats[${index}]`;
  if (typeof raw !== 'object' || raw === null) fail(where, 'must be an object');
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'number') fail(where, '`id` must be a number');

  if (r.type === 'story_beat') {
    if (!Array.isArray(r.doodles)) fail(where, '`doodles` must be an array');
    return {
      id: r.id,
      type: 'story_beat',
      narration: text(r.narration, where, 'narration'),
      doodles: r.doodles.map((d, i) => parseDoodleRef(d, `${where}.doodles[${i}]`, knownElementIds)),
    };
  }

  if (r.type === 'formal_beat') {
    if (r.style === 'check_in_question') {
      if (!Array.isArray(r.options) || r.options.length < 2 || r.options.some((o) => typeof o !== 'string')) {
        fail(where, 'check_in_question needs an `options` array of at least two strings');
      }
      if (typeof r.correct_index !== 'number' || r.correct_index < 0 || r.correct_index >= r.options.length) {
        fail(where, '`correct_index` must index into `options`');
      }
      return {
        id: r.id,
        type: 'formal_beat',
        style: 'check_in_question',
        question: text(r.question, where, 'question'),
        options: (r.options as string[]).map((o) => o.replace(/\s+/g, ' ').trim()),
        correct_index: r.correct_index,
        wrong_answer_reactions: (r.wrong_answer_reactions as Record<string, string>) ?? undefined,
      };
    }

    if (!(CONTENT_STYLES as string[]).includes(r.style as string)) {
      fail(where, `unknown formal style ${JSON.stringify(r.style)}`);
    }
    return {
      id: r.id,
      type: 'formal_beat',
      style: r.style as ContentStyle,
      content: text(r.content, where, 'content'),
      emphasis: r.emphasis !== undefined ? text(r.emphasis, where, 'emphasis') : undefined,
    };
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
    question: text(r.question, where, 'question'),
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

  // true_false normalizes to a fixed two-option shape; multiple_choice keeps its own.
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
  return {
    ...base,
    options: (options as string[]).map((o) => o.replace(/\s+/g, ' ').trim()),
    correct_index: r.correct_index,
  };
}

/** Validates the end-of-topic test (§8.4). Every question must tag a real beat;
 *  the count must land in the 10–15 range that scales with topic complexity. */
export function parseQuiz(raw: unknown, beatIds: Set<number>): QuizQuestion[] {
  if (!Array.isArray(raw)) fail('quiz', 'must be an array');
  if (raw.length < QUIZ_MIN || raw.length > QUIZ_MAX) {
    fail('quiz', `must have ${QUIZ_MIN}–${QUIZ_MAX} questions (got ${raw.length})`);
  }
  return raw.map((q, i) => parseQuizQuestion(q, i, beatIds));
}

/** Validates and normalizes a generated board script (§8.2). A `quiz`, when
 *  present, is validated against the beats it tags (§8.4); a script without one
 *  still parses so legacy/quiz-less lessons render. */
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
  };
}
