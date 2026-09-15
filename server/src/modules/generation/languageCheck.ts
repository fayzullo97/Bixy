// Basic language sanity for a generated board script (§8.7, Part 01 §1). The
// language rule is per-FIELD, not per-beat: every field in the schema belongs to
// exactly one language, always. This check enforces that split mechanically.
//
// We can't cheaply judge fluency, but we can judge *script* — which reliably
// catches the failure modes that actually occur: a `ru` lesson whose narration
// came back in English, or the documented Haiku slip of translating a field that
// must stay English.

import type { BoardScript } from './boardScript.js';
import type { Language } from './systemPrompt.js';

const CYRILLIC = /[Ѐ-ӿ]/g;
const LATIN = /[A-Za-z]/g;

// Below this many script-bearing letters we can't judge reliably, so we don't
// block — better to serve than to retry-loop on a legitimately terse lesson.
const MIN_LETTERS = 12;

export function countScripts(text: string): { cyrillic: number; latin: number } {
  return {
    cyrillic: (text.match(CYRILLIC) ?? []).length,
    latin: (text.match(LATIN) ?? []).length,
  };
}

/** One checkable field, tagged with which language it must be written in. */
interface Field {
  /** Where it lives, e.g. `beats[3].note` — quoted back to the model on a miss. */
  label: string;
  text: string;
  bucket: 'english' | 'localized';
}

/**
 * Flattens a script into its language-tagged fields.
 *
 * ENGLISH — the material being taught or tested, at every level A1–C1: the
 * English-locked formal-beat fields, every check-in and quiz testable item, AND
 * speech/thought bubble dialogue.
 *
 * Bubbles are English because the story track demonstrates the grammar by having
 * characters speak it — for `present_simple_be` the bubbles literally are "I am
 * an engineer" / "It is cold". Translating those teaches nothing about English
 * "to be". The narration localizes and explains what the drawn scene is showing.
 * (Part 01 §1 briefly had bubbles following the narration; generation showed that
 * destroys the demonstrated sentence, so they're locked with `sentence`.)
 *
 * LOCALIZED — Bixy's wording about that material, following the effective
 * content language: narration, every `note`, and every wrong-answer reaction
 * (feedback, not a testable item).
 */
function fields(script: BoardScript): Field[] {
  const out: Field[] = [];
  const add = (label: string, text: string | undefined, bucket: Field['bucket']) => {
    if (text && text.trim()) out.push({ label, text, bucket });
  };

  script.beats.forEach((b, i) => {
    const at = `beats[${i}]`;
    if (b.type === 'story_beat') {
      add(`${at}.narration`, b.narration, 'localized');
      b.doodles.forEach((d, j) => add(`${at}.doodles[${j}].text`, d.text, 'english'));
      return;
    }
    switch (b.style) {
      case 'title':
        add(`${at}.term`, b.term, 'english');
        break;
      case 'formula':
        add(`${at}.formula`, b.formula, 'english');
        add(`${at}.note`, b.note, 'localized');
        break;
      case 'explanation':
        add(`${at}.note`, b.note, 'localized');
        break;
      case 'example':
        add(`${at}.sentence`, b.sentence, 'english');
        add(`${at}.note`, b.note, 'localized');
        break;
      case 'recap_example':
        add(`${at}.sentence`, b.sentence, 'english');
        add(`${at}.emphasis`, b.emphasis, 'english');
        add(`${at}.note`, b.note, 'localized');
        break;
      case 'common_mistake':
        add(`${at}.wrong`, b.wrong, 'english');
        add(`${at}.correct`, b.correct, 'english');
        add(`${at}.note`, b.note, 'localized');
        break;
      case 'check_in_question':
        add(`${at}.question`, b.question, 'english');
        b.options.forEach((o, j) => add(`${at}.options[${j}]`, o, 'english'));
        for (const [k, v] of Object.entries(b.wrong_answer_reactions ?? {})) {
          add(`${at}.wrong_answer_reactions["${k}"]`, v, 'localized');
        }
        break;
    }
  });

  (script.quiz ?? []).forEach((q, i) => {
    const at = `quiz[${i}]`;
    add(`${at}.question`, q.question, 'english');
    q.options?.forEach((o, j) => add(`${at}.options[${j}]`, o, 'english'));
    q.accepted_answers?.forEach((a, j) => add(`${at}.accepted_answers[${j}]`, a, 'english'));
  });

  return out;
}

/**
 * Majority-Cyrillic test for ONE field. Returns null when the field is too short
 * to judge — below this, script counts are noise, so we don't block.
 */
function isCyrillic(text: string): boolean | null {
  const { cyrillic, latin } = countScripts(text);
  if (cyrillic + latin < MIN_LETTERS) return null;
  return cyrillic > latin;
}

/**
 * Returns a correction string when a field's language looks wrong for the
 * request, or null when the script looks fine. Fed into the generation retry loop
 * the same way a schema miss is — a language slip is a generation miss we retry,
 * not a lesson we serve (§8.10: no silent degradation).
 *
 * Checked FIELD BY FIELD, not in aggregate: that's the whole payoff of the
 * per-field schema split (Part 01 §1). An aggregate majority lets one
 * untranslated field hide behind its correctly-written neighbours, which is
 * precisely the bug class the split exists to catch. Per-field also lets the
 * correction name the offending path, so the retry is targeted.
 *
 * `language` is the EFFECTIVE content language (`contentLanguage(level,
 * appLanguage)`), so a C1 lesson is checked as fully English.
 *
 * Only Cyrillic-vs-Latin is distinguishable this cheaply, so for `uz`/`en` (both
 * Latin) we can confirm a field isn't Cyrillic but not that Uzbek wasn't served
 * as English — an accepted limit of a *basic* sanity check, unchanged from v1.
 */
export function scriptLanguageIssue(script: BoardScript, language: Language): string | null {
  for (const field of fields(script)) {
    const cyrillic = isCyrillic(field.text);
    if (cyrillic === null) continue;

    if (field.bucket === 'english' && cyrillic) {
      return `\`${field.label}\` must be in English — it is the English material being taught or tested, so it is never translated, at any level. Put your own wording about it in a \`note\` instead.`;
    }

    if (field.bucket === 'localized') {
      if (language === 'ru' && !cyrillic) {
        return `\`${field.label}\` must be written in Russian (Cyrillic script) — narration, \`note\` and \`wrong_answer_reactions\` all follow the student's language. Keep English grammar terminology (e.g. "Present Perfect") in English inside it, but write the sentence itself in Russian.`;
      }
      if ((language === 'uz' || language === 'en') && cyrillic) {
        const want = language === 'uz' ? 'Uzbek (Latin script)' : 'English';
        return `\`${field.label}\` must be written in ${want}, not Cyrillic.`;
      }
    }
  }

  return null;
}
