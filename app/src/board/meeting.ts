/**
 * The one-time first meeting (Part 05 §7), as pure state.
 *
 * A short set of get-to-know-you questions. Every step is skippable — one
 * question, or the whole conversation — so the interesting behaviour here is
 * what a skip does, which is why it lives outside the component and is tested
 * directly.
 *
 * The introduction Bixy used to open this with moved to the greeting (Part 07
 * §12 step 2), which now runs before the level check and in the student's own
 * language. So the conversation starts at the first question: by the time it
 * runs, Bixy has already said who it is, and saying it twice reads as a bug.
 */

/** The questions, in the order they're asked. Keys match the server's profile. */
export const MEETING_FIELDS = [
  'occupation',
  'study_place',
  'hobbies',
  'interests',
  'motivation',
] as const;

export type MeetingField = (typeof MEETING_FIELDS)[number];

export type MeetingAnswers = Partial<Record<MeetingField, string>>;

export interface MeetingState {
  /** One step per field, then 'done'. */
  step: 'question' | 'done';
  /** Index into MEETING_FIELDS while `step` is 'question'. */
  index: number;
  answers: MeetingAnswers;
}

export const initialMeeting: MeetingState = { step: 'question', index: 0, answers: {} };

/** The field being asked right now, or null outside the question steps. */
export function currentField(state: MeetingState): MeetingField | null {
  if (state.step !== 'question') return null;
  return MEETING_FIELDS[state.index] ?? null;
}

/** Move past the current question, ending the meeting after the last one. */
function advance(state: MeetingState, answers: MeetingAnswers): MeetingState {
  const next = state.index + 1;
  if (next >= MEETING_FIELDS.length) return { step: 'done', index: next, answers };
  return { step: 'question', index: next, answers };
}

/**
 * Record an answer and move on. A blank answer is treated exactly as a skip —
 * storing an empty string would put a meaningless line in the prompt that reads
 * as the student having told Bixy nothing in particular about themselves.
 */
export function answerQuestion(state: MeetingState, text: string): MeetingState {
  const field = currentField(state);
  if (!field) return state;
  const trimmed = text.trim();
  if (!trimmed) return advance(state, state.answers);
  return advance(state, { ...state.answers, [field]: trimmed });
}

/** Skip just this question, keeping everything already answered. */
export function skipQuestion(state: MeetingState): MeetingState {
  const field = currentField(state);
  if (!field) return state;
  return advance(state, state.answers);
}

/**
 * Skip the rest of the conversation. Answers already given are kept: the student
 * chose to stop, not to retract what they'd already said — and the meeting still
 * ends, so it is never re-asked on a later visit.
 */
export function skipMeeting(state: MeetingState): MeetingState {
  return { step: 'done', index: MEETING_FIELDS.length, answers: state.answers };
}
