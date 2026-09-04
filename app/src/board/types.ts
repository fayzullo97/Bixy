// The "board script" — the core lesson artifact (§8.2). A lesson is a sequence
// of beats, each either a story_beat (narration + doodles) or a formal_beat
// (color-coded written content or a check-in question).

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
  /** Public URL of the synthesized narration WAV, when audio has been generated. */
  audio_url?: string;
}

/** formal_beat styles that carry a single `content` string (+ optional emphasis). */
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
  /** Grammar marker highlighted in blue within recap text (§8.2/§8.3). */
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

export interface BoardScript {
  topic_id: string;
  level: string;
  beats: Beat[];
  /** The end-of-topic test (§8.4); absent on legacy/quiz-less scripts. */
  quiz?: QuizQuestion[];
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
