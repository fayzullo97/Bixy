import type { Language } from '../generation/systemPrompt.js';

/**
 * Pre-generated greeting audio (Part 07 §12 step 2).
 *
 * The greeting used to be synthesized live on every arrival, which put ~5s of
 * silence between the screen appearing and Bixy speaking — the student's first
 * impression of the product was a dead screen. The text is fixed, so there is
 * nothing to synthesize per-visit: these variants are generated once by
 * `src/scripts/gen-greeting-clips.ts`, stored in the narration bucket, and
 * served as a plain URL the client can play the instant the screen mounts.
 *
 * **No student name.** The previous greeting interpolated the Telegram profile
 * name, which is what forced live synthesis in the first place. Many Telegram
 * profiles carry no real name (a handle, an emoji, or nothing), so the
 * personalization was unreliable as well as slow. The greeting is generic and
 * introduces Bixy instead.
 *
 * Variants exist so a returning student doesn't hear a recording they can
 * recite; they are interchangeable in meaning, not sequenced.
 */
export interface GreetingVariant {
  /** Stable id — also the clip's filename, so ids must not be renamed casually. */
  id: string;
  /** Exactly what is spoken AND displayed. Keep the two identical. */
  text: string;
}

/**
 * Three interchangeable openers per language: a greeting plus the smallest
 * self-introduction that still says who Bixy is and what it does. This screen is
 * also the introduction for a student who has never met it (the old
 * `firstMeeting` branch folded in here), so the name and the subject have to
 * survive any trim; everything else does not.
 *
 * **One clause, ~4s.** The first pass at these (ids `*-1`..`*-3`) ran 5.4–10.2s,
 * which traded one problem for another: playback started instantly, but the
 * "tap to continue" hint stays hidden while `speaking` is true, so a student
 * could sit for ten seconds with no visible affordance. (The tap itself always
 * worked — the whole screen is the Pressable — but the cue was invisible.)
 * Keep new variants to a single clause for the same reason.
 *
 * **Ids are versioned, not reused.** Clip paths are derived from the id and the
 * bucket is public/CDN-fronted, so editing a variant's text under its old id
 * leaves stale bytes cached at a URL that now claims to say something else.
 * Changing text means a new id. `*-1`..`*-3` are retired, not deleted.
 */
export const GREETING_VARIANTS: Record<Language, GreetingVariant[]> = {
  en: [
    { id: 'en-4', text: "Hi, I'm Bixy — I teach English grammar on a board." },
    { id: 'en-5', text: "Hello, I'm Bixy, your English grammar tutor." },
    { id: 'en-6', text: "Hi, I'm Bixy — let's do some English grammar." },
  ],
  uz: [
    { id: 'uz-8', text: "Salom, Men Bixyman, sizga Ingiliz tili gramatikasini o'rgataman" },
    { id: 'uz-5', text: "Salom, men Bixy, ingliz tili grammatikasi bo'yicha ustozingiz." },
    { id: 'uz-6', text: "Assalomu alaykum, men Bixy — keling, grammatikani birga o'rganamiz." },
  ],
  ru: [
    { id: 'ru-4', text: 'Привет, я Бикси — объясняю английскую грамматику на доске.' },
    { id: 'ru-5', text: 'Здравствуйте, я Бикси, ваш преподаватель английской грамматики.' },
    { id: 'ru-6', text: 'Привет, я Бикси — давайте разберём английскую грамматику.' },
  ],
};

/** Storage path for one clip inside the narration bucket. Stable across runs so
 *  regenerating overwrites rather than accumulating orphans. */
export function greetingClipPath(language: Language, variantId: string): string {
  return `greeting/${language}/${variantId}.wav`;
}

/**
 * Pick a variant for this arrival. Random rather than round-robin: there is no
 * per-student state to rotate against here, and with three options random is
 * indistinguishable from rotation in practice.
 */
export function pickGreetingVariant(language: Language): GreetingVariant {
  const variants = GREETING_VARIANTS[language] ?? GREETING_VARIANTS.en;
  return variants[Math.floor(Math.random() * variants.length)]!;
}
