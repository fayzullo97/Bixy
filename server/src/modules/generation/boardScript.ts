// Server-side board-script types + validator (§8.2), ported from the client
// renderer so generated scripts are validated before storage. Adds `speech`,
// the synthesized narration, populated by the TTS step.

import type { Language } from './systemPrompt.js';

/**
 * One spoken clip: the exact text voiced, the language it's voiced in, and the
 * stored audio. Part 02 §5 makes the formal track spoken too, and a formal beat
 * mixes languages by design (Part 01 §1 — an English `sentence` alongside a
 * localized `note`), so language belongs on the UNIT, not the beat. That's what
 * lets each clip route to the right provider (Part 01 §2).
 *
 * Derived mechanically from the beat's own fields rather than generated — the
 * model is never asked to restate what it already wrote, so there is no new way
 * for generation to drift from the board.
 *
 * Part 02 §3 extends this with per-sentence splitting and word timings; both are
 * additive to this shape.
 */
export interface SpokenUnit {
  /** Exactly the text voiced in this clip. */
  text: string;
  /** Which language it is voiced in — drives provider routing (Part 01 §2). */
  language: Language;
  /** Public URL of the synthesized WAV (filled in by the TTS step). */
  audio_url?: string;
  /**
   * The sentences `audio_url` was spliced from, with exact spoken durations and
   * offsets (Part 02 §3). Sentences are synthesized separately and rejoined with
   * a 400ms gap, so these offsets are exact rather than estimated — they back
   * the proportional-timing fallback when Whisper word alignment is unavailable.
   */
  sentences?: SentenceTiming[];
  /** Total length of `audio_url`, gaps included. */
  duration_ms?: number;
  /**
   * Word-level playback timings driving the rolling subtitle window (Part 02
   * §3). Present only where the window can be trusted: story narration in a
   * Whisper-supported language. Absent means the client shows the full text
   * instead — which is what Uzbek lessons do until Whisper accuracy on Aisha
   * audio has its own test.
   */
  words?: WordTiming[];
}

/** One script word with the playback time the subtitle should reveal it at. */
export interface WordTiming {
  text: string;
  start_ms: number;
  end_ms: number;
}

/** One sentence's slice of a spliced clip (Part 02 §3). */
export interface SentenceTiming {
  text: string;
  duration_ms: number;
  start_ms: number;
}

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
  /** Synthesized narration (filled in by the TTS step). Replaces v1's single
   *  `audio_url`: every beat type now narrates through the same field. */
  speech?: SpokenUnit[];
}

export type ContentStyle =
  | 'title'
  | 'formula'
  | 'explanation'
  | 'example'
  | 'common_mistake'
  | 'recap_example';

// Formal beats are split per-field by style (Part 01 §1) so the language rule is
// STRUCTURAL, not a prompt convention: every field below belongs to exactly one
// language, always. English-locked fields carry the material being taught
// (`term`, `formula`, `sentence`, `emphasis`, `wrong`, `correct`); `note` carries
// Bixy's wording ABOUT that material and follows the effective content language.
//
// The alternative — localizing a whole beat by style and trusting the model to
// keep an English example correctly embedded inside otherwise-translated prose —
// is the exact failure mode this project keeps hitting, and can't be validated
// mechanically. Separate fields can.

interface BaseFormalBeat {
  id: number;
  type: 'formal_beat';
  /** Synthesized narration of this beat's own fields (Part 02 §5), in board
   *  order. Absent on a check-in means only the stem is voiced; the options stay
   *  silent by design. Filled in by the TTS step, never by the model. */
  speech?: SpokenUnit[];
}

/** The topic name — grammar terminology, so English at every level. */
export interface TitleBeat extends BaseFormalBeat {
  style: 'title';
  term: string;
}

/** The rule's shape, e.g. "have / has + past participle". */
export interface FormulaBeat extends BaseFormalBeat {
  style: 'formula';
  formula: string;
  note?: string;
}

/** Pure commentary about the rule — no English-locked field, so `note` is all of it. */
export interface ExplanationBeat extends BaseFormalBeat {
  style: 'explanation';
  note: string;
}

/** A correct English example sentence. */
export interface ExampleBeat extends BaseFormalBeat {
  style: 'example';
  sentence: string;
  note?: string;
}

/** A discovery sentence written out, with the grammar marker in `emphasis`. */
export interface RecapBeat extends BaseFormalBeat {
  style: 'recap_example';
  sentence: string;
  emphasis?: string;
  note?: string;
}

/**
 * The wrong/correct pair, each in its own field. The reference outlines state
 * these inline in prose ("saying 'Is cold today' instead of 'It's cold today' —
 * English always needs the subject"); splitting them is what lets the surrounding
 * explanation localize without dragging the two English sentences along with it.
 */
export interface MistakeBeat extends BaseFormalBeat {
  style: 'common_mistake';
  wrong: string;
  correct: string;
  note: string;
}

export type ContentFormalBeat =
  | TitleBeat
  | FormulaBeat
  | ExplanationBeat
  | ExampleBeat
  | RecapBeat
  | MistakeBeat;

/** Fields that are ALWAYS English — the target-language material (Part 01 §1). */
export const ENGLISH_FIELDS = ['term', 'formula', 'sentence', 'emphasis', 'wrong', 'correct'] as const;
/** Fields that ALWAYS follow the effective content language. */
export const LOCALIZED_FIELDS = ['note'] as const;

/**
 * Bumped whenever a change to this contract makes previously generated scripts
 * unservable. Part of the result-cache key, so stale rows are never matched
 * instead of needing a bulk delete — and the client validator never receives an
 * old-shape script it would reject.
 *
 * v1 — Part 01 §1: formal beats split per-field by style, cache keyed by
 *      effective content language.
 * v2 — Part 02 §3/§5: every beat narrates via `speech`, per-sentence splice,
 *      word timings, `quiz_intro`.
 *
 * Part 02's own change would self-heal without this: `narrationComplete` now
 * covers the whole script, so a v1-shaped row fails the gate and regenerates on
 * its own. The bump is deliberate anyway — a row that stops matching on its
 * VERSION is an explicit, greppable signal, whereas one that silently fails a
 * completeness predicate looks identical to a transient TTS outage in the logs.
 */
export const BOARD_SCRIPT_RULE_VERSION = 2;

export interface CheckInBeat extends BaseFormalBeat {
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
  /**
   * Spoken transition into the end-of-topic test (Part 02 §5) — e.g. "Okay,
   * let's see how much you understand." Model-generated, so it's phrased in
   * Bixy's voice, and written in the effective content language like any other
   * localized field (Part 01 §1). The test itself stays silent.
   */
  quiz_intro?: string;
  /** Synthesized `quiz_intro` (filled in by the TTS step). */
  quiz_intro_speech?: SpokenUnit[];
  /**
   * In-persona reactions to a failing topic-test score (Part 04 §6), pre-generated
   * per failing tier so the announcement is in Bixy's own words without a model
   * round-trip at the exact moment a student has just failed.
   */
  score_reactions?: ScoreReactions;
}

/**
 * A handful of phrasings per failing tier. Each contains the literal token
 * `{score}`, substituted with the student's percentage at display time — which is
 * also why these are text-only rather than spoken: the number isn't known until
 * the moment of failure, so the line can't be synthesized in advance, and
 * synthesizing six variants per lesson to use one would be waste.
 *
 * Written in the effective content language, like any other Bixy wording.
 */
export interface ScoreReactions {
  /** Below 50% — the whole topic gets re-taught. */
  reteach_all: string[];
  /** 50–79% — only the missed parts get re-taught. */
  reteach_missed: string[];
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

const QUIZ_TYPES: QuizQuestionType[] = ['multiple_choice', 'true_false', 'fill_in_the_blank'];

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

    // Tolerant reader, strict writer: each style's required fields are enforced
    // (a miss is a generation miss we retry), and anything extra is dropped
    // rather than carried through — the shapes below are built explicitly.
    const optional = (field: string) => (r[field] !== undefined ? text(r[field], where, field) : undefined);

    switch (r.style) {
      case 'title':
        return { id: r.id, type: 'formal_beat', style: 'title', term: text(r.term, where, 'term') };
      case 'formula':
        return {
          id: r.id,
          type: 'formal_beat',
          style: 'formula',
          formula: text(r.formula, where, 'formula'),
          note: optional('note'),
        };
      case 'explanation':
        return { id: r.id, type: 'formal_beat', style: 'explanation', note: text(r.note, where, 'note') };
      case 'example':
        return {
          id: r.id,
          type: 'formal_beat',
          style: 'example',
          sentence: text(r.sentence, where, 'sentence'),
          note: optional('note'),
        };
      case 'recap_example':
        return {
          id: r.id,
          type: 'formal_beat',
          style: 'recap_example',
          sentence: text(r.sentence, where, 'sentence'),
          emphasis: optional('emphasis'),
          note: optional('note'),
        };
      case 'common_mistake':
        return {
          id: r.id,
          type: 'formal_beat',
          style: 'common_mistake',
          wrong: text(r.wrong, where, 'wrong'),
          correct: text(r.correct, where, 'correct'),
          note: text(r.note, where, 'note'),
        };
      default:
        return fail(where, `unknown formal style ${JSON.stringify(r.style)}`);
    }
  }

  // Naming the likely confusion matters: this string is fed straight back into
  // the generation retry loop, and a bare "unknown beat type" left the model
  // repeating the same style-as-type slip on every attempt.
  if ((CONTENT_STYLES as string[]).includes(r.type as string) || r.type === 'check_in_question') {
    return fail(
      where,
      `\`type\` must be "story_beat" or "formal_beat" — ${JSON.stringify(r.type)} is a \`style\`, not a type. Write { "type": "formal_beat", "style": ${JSON.stringify(r.type)}, ... }`,
    );
  }
  if ((QUIZ_TYPES as string[]).includes(r.type as string)) {
    return fail(
      where,
      `${JSON.stringify(r.type)} is a quiz question type. The end-of-topic test belongs ONLY in the top-level \`quiz\` array — remove it from \`beats\`.`,
    );
  }
  return fail(where, `unknown beat type ${JSON.stringify(r.type)} (expected "story_beat" or "formal_beat")`);
}

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

/**
 * Reads the pre-generated failing-score reactions (Part 04 §6). Tolerant: a tier
 * that came back short or malformed yields an empty list, and the board falls
 * back to a plain announcement rather than failing a lesson over flavour text.
 */
function parseScoreReactions(raw: unknown): ScoreReactions {
  const tier = (value: unknown, where: string): string[] => {
    if (!Array.isArray(value)) return [];
    return value
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
      .map((v) => text(v, where, 'reaction'));
  };
  const r = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  return {
    reteach_all: tier(r.reteach_all, 'score_reactions.reteach_all'),
    reteach_missed: tier(r.reteach_missed, 'score_reactions.reteach_missed'),
  };
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
    // `speech` is never read off model output — the TTS step derives and fills it.
    ...(r.quiz_intro !== undefined ? { quiz_intro: text(r.quiz_intro, '', 'quiz_intro') } : {}),
    ...(r.score_reactions !== undefined ? { score_reactions: parseScoreReactions(r.score_reactions) } : {}),
  };
}
