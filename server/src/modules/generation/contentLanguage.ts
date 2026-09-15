import type { Language } from './systemPrompt.js';

/**
 * CEFR tiers that stay fully English at every layer (Part 01 §1). C1 students are
 * already fluent enough that localization stops earning its keep.
 *
 * Note this IS a behavior change from shipped v1, which had no level check at
 * all — a C1 student with Russian selected gets Russian narration today. Part 01
 * calls that an accidental v1 gap against the original design intent, not a
 * regression, and resolves it here.
 */
const ENGLISH_ONLY_LEVELS = new Set(['C1']);

/**
 * The language a lesson's localizable fields are actually written in: the
 * student's selected language for A1–B2, English for C1 regardless of selection.
 *
 * This is the single source of truth for the level gate — generation, the
 * language sanity check, and the result-cache key all derive from it, so a C1
 * topic requested as en/uz/ru resolves to one cached English row rather than
 * three identical ones.
 */
export function contentLanguage(level: string, appLanguage: Language): Language {
  return ENGLISH_ONLY_LEVELS.has(level.trim().toUpperCase()) ? 'en' : appLanguage;
}
