// The "board script" — the core lesson artifact (§8.2). A lesson is a sequence
// of beats, each either a story_beat (narration + doodles) or a formal_beat
// (color-coded written content or a check-in question).

export type Language = 'en' | 'uz' | 'ru';

/**
 * One spoken clip: the exact text voiced, the language it's voiced in, and the
 * stored audio (Part 02 §5). Language sits on the UNIT because a formal beat
 * mixes languages by design — an English `sentence` beside a localized `note`
 * (Part 01 §1) — and each routes to a different TTS provider server-side.
 */
export interface SpokenUnit {
  text: string;
  language: Language;
  audio_url?: string;
  /** Sentences the clip was spliced from, with exact offsets (Part 02 §3). */
  sentences?: SentenceTiming[];
  /** Total clip length, 400ms inter-sentence gaps included. */
  duration_ms?: number;
  /**
   * Word timings for the rolling subtitle window (Part 02 §3). Present only for
   * story narration in a Whisper-supported language; absent means show the full
   * text instead, which is what Uzbek lessons do for now.
   */
  words?: WordTiming[];
}

export interface SentenceTiming {
  text: string;
  duration_ms: number;
  start_ms: number;
}

export interface WordTiming {
  text: string;
  start_ms: number;
  end_ms: number;
}

export type DoodlePosition = 'left' | 'center' | 'right';

export interface DoodleRef {
  element_id: string;
  position?: DoodlePosition;
  /** Attach to another element in the scene by its element_id (e.g. a person). */
  attached_to?: string;
  /** Dialogue text inside a speech_bubble / thought_bubble. */
  text?: string;
}

export interface StoryBeat {
  id: number;
  type: 'story_beat';
  narration: string;
  doodles: DoodleRef[];
  /** Synthesized narration, when audio has been generated. Every beat type
   *  narrates through this same field (Part 02 §5). */
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
// structural, not a prompt convention: every field belongs to exactly one
// language, always. English-locked fields carry the material being taught
// (`term`, `formula`, `sentence`, `emphasis`, `wrong`, `correct`); `note` carries
// Bixy's wording about it and follows the effective content language
// (the student's language for A1–B2, English at C1).

interface BaseFormalBeat {
  id: number;
  type: 'formal_beat';
  /** Synthesized narration of this beat's own fields, in board order (Part 02
   *  §5). On a check-in only the stem is voiced — options stay silent. */
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

/** A discovery sentence written out, grammar marker highlighted in blue (§8.3). */
export interface RecapBeat extends BaseFormalBeat {
  style: 'recap_example';
  sentence: string;
  emphasis?: string;
  note?: string;
}

/** The wrong/correct pair, each in its own field so `note` can localize freely. */
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

export interface CheckInBeat extends BaseFormalBeat {
  style: 'check_in_question';
  question: string;
  options: string[];
  correct_index: number;
  wrong_answer_reactions?: Record<string, string>;
}

export type FormalBeat = ContentFormalBeat | CheckInBeat;
export type Beat = StoryBeat | FormalBeat;

/** End-of-topic test question (§8.4). MC/TF carry `options` + `correct_index`;
 *  fill-in-the-blank carries `accepted_answers` (graded server-side, §8.11).
 *  Each is tagged to the beat it tests, driving missed-concept re-teach. */
export type QuizQuestionType = 'multiple_choice' | 'true_false' | 'fill_in_the_blank';

export interface QuizQuestion {
  quiz_question_id: number;
  type: QuizQuestionType;
  question: string;
  options?: string[];
  correct_index?: number;
  accepted_answers?: string[];
  tests_beat_id: number;
}

/** The two failing tiers (Part 04 §6) — 'passed' has no score reaction. */
export type MasteryOutcomeFailing = 'reteach_all' | 'reteach_missed';

/** Pre-generated in-persona reactions to a failing score, per tier. Each
 *  phrasing carries a literal `{score}` token substituted at display time. */
export interface ScoreReactions {
  reteach_all: string[];
  reteach_missed: string[];
}

export interface BoardScript {
  topic_id: string;
  level: string;
  beats: Beat[];
  /** The end-of-topic test (§8.4); absent on legacy/quiz-less scripts. */
  quiz?: QuizQuestion[];
  /** Spoken hand-off into the test (Part 02 §5) — replaces the hardcoded
   *  English "Quick test" note, and is level-gated like any narration. */
  quiz_intro?: string;
  quiz_intro_speech?: SpokenUnit[];
  score_reactions?: ScoreReactions;
}

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

export const FORMAL_STYLES = [...CONTENT_STYLES, 'check_in_question'] as const;
