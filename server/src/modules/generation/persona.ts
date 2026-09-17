import type { Language } from './systemPrompt.js';

/**
 * What the student told Bixy when they first met (Part 05 §7).
 *
 * Every field is optional: each question is individually skippable, and the
 * whole conversation can be skipped outright, so a profile is routinely empty or
 * partial. Free text in the student's own words — never parsed, only quoted back
 * into a prompt.
 */
export interface StudentProfile {
  hobbies?: string;
  occupation?: string;
  interests?: string;
  study_place?: string;
  motivation?: string;
}

/** The per-student, per-request persona inputs (Part 05 §8). */
export interface PersonaContext {
  /** Patience mode: this student has hit the consecutive-re-teach trigger on
   *  THIS topic (see `PATIENCE_STREAK`). */
  patient: boolean;
  profile: StudentProfile;
}

/**
 * Consecutive whole-topic re-teaches (a sub-50% test) on one topic before the
 * tone shifts (Part 05 §8).
 *
 * Two, not one: the spec is explicit that a single hard topic is not a struggle
 * pattern. Shifting on the first miss would make the patient register the
 * default voice, which is exactly the flattening this trigger exists to avoid.
 */
export const PATIENCE_STREAK = 2;

/** Whether this student has struggled enough on this topic to shift the tone. */
export function isPatient(reteachAllStreak: number): boolean {
  return reteachAllStreak >= PATIENCE_STREAK;
}

const PROFILE_LABELS: Array<[keyof StudentProfile, string]> = [
  ['occupation', 'What they do'],
  ['study_place', 'Where they study'],
  ['hobbies', 'Hobbies'],
  ['interests', 'Interests'],
  ['motivation', 'Why they are learning English'],
];

/** Student-written text, flattened so it can't restructure the prompt around it. */
function sanitize(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 200);
}

/**
 * The per-request persona fragment (Part 05 §8), appended to the USER message.
 *
 * Deliberately not part of the system prompt: that block is one cached,
 * byte-identical string shared by every student, which structurally cannot carry
 * anything per-student. That mismatch is the actual root cause of why the tone
 * shift and the profile were designed in v1 and never worked — not a missing
 * instruction. Anything varying per student has to ride the uncached message.
 *
 * Returns '' when there is nothing to personalize, which is also the signal that
 * the shared lesson cache is still usable for this request.
 */
export function personaFragment(ctx: PersonaContext): string {
  const parts: string[] = [];

  if (ctx.patient) {
    parts.push(
      `This student has now been through the whole of this topic ${PATIENCE_STREAK} times in a row without it landing. Shift into your patient register for this lesson: slow down, take smaller steps, and lean harder on the concrete scenario before naming any rule. Acknowledge the repetition once, lightly and without pity — they know how many times they've seen this — then teach it a genuinely different way rather than restating the previous explanation more loudly. Never praise effort in place of progress, and never suggest the topic is too hard for them.`,
    );
  }

  const known = PROFILE_LABELS.filter(([key]) => {
    const value = ctx.profile[key];
    return typeof value === 'string' && value.trim().length > 0;
  });

  if (known.length > 0) {
    const lines = known.map(([key, label]) => `- ${label}: ${sanitize(ctx.profile[key]!)}`).join('\n');
    parts.push(
      `What this student told you when you first met:\n${lines}\n\nUse it the way a tutor who remembers a student would: pick scenarios and examples from their world when one genuinely fits, and pitch your asides to who they are. Don't perform it — no listing their answers back at them, no forcing a hobby into a topic it doesn't suit. If nothing fits this topic, ignore it entirely. The grammar being taught never changes because of this.`,
    );
  }

  return parts.join('\n\n');
}

const DEFLECTION_LANGUAGE: Record<Language, string> = {
  en: 'English',
  uz: 'Uzbek',
  ru: 'Russian',
};

/**
 * The in-character reply to "are you real?" (Part 05 §8).
 *
 * The persona has carried this instruction since v1, but nothing ever routed a
 * real message to it: identity questions match no topic, so they fell through to
 * either a re-explanation of the open lesson or a flat "I don't have information
 * about that." This is the prompt behind the detection step that fixes that.
 */
export function deflectionPrompt(language: Language): string {
  return `You are Bixy, an AI whiteboard tutor for English grammar — an invented character, gender-ambiguous, warm and down-to-earth, never a hype machine.

A student has just asked whether you are real, human, a bot, or an AI. Answer in ONE or TWO short sentences, in ${DEFLECTION_LANGUAGE[language]}:
- Stay in character and stay playful. This is a light moment, not a disclosure form.
- Never claim to be human, and never imply you might be. If they ask directly, they get a straight answer inside your own voice.
- Never break into system/model talk — no "as an AI language model", no vendor names, no explaining how you were built.
- Close by turning back toward the lesson, lightly, without a hard sell.

Reply with the line only — no quotes, no preamble.`;
}
