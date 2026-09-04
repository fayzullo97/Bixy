// Basic language sanity for a generated board script (§8.7). The language rule is
// asymmetric: ONLY `story_beat.narration` is in the student's language; ALL
// written board text (formal beats, check-in questions/options, the quiz) stays
// English. We can't cheaply judge fluency, but we can judge *script* — which
// reliably catches the failure modes that actually occur: a `ru` lesson whose
// narration came back in English, or the documented Haiku slip of writing a
// check-in in the narration language instead of English.

import type { BoardScript, StoryBeat } from './boardScript.js';
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

function narrationText(script: BoardScript): string {
  return script.beats
    .filter((b): b is StoryBeat => b.type === 'story_beat')
    .map((b) => b.narration)
    .join(' ');
}

function boardText(script: BoardScript): string {
  const parts: string[] = [];
  for (const b of script.beats) {
    if (b.type !== 'formal_beat') continue;
    if (b.style === 'check_in_question') parts.push(b.question, ...b.options);
    else {
      parts.push(b.content);
      if (b.emphasis) parts.push(b.emphasis);
    }
  }
  for (const q of script.quiz ?? []) {
    parts.push(q.question);
    if (q.options) parts.push(...q.options);
    if (q.accepted_answers) parts.push(...q.accepted_answers);
  }
  return parts.join(' ');
}

/**
 * Returns a correction string when the script's language looks wrong for the
 * request, or null when it looks fine. Fed into the generation retry loop the
 * same way a schema miss is — a language slip is a generation miss we retry, not
 * a lesson we serve (§8.10: no silent degradation).
 *
 * Only Cyrillic-vs-Latin is distinguishable this cheaply, so for `uz`/`en`
 * (both Latin) we can confirm the narration isn't Cyrillic but not that Uzbek
 * wasn't served as English — an accepted limit of a *basic* sanity check.
 */
export function scriptLanguageIssue(script: BoardScript, language: Language): string | null {
  const n = countScripts(narrationText(script));
  if (n.cyrillic + n.latin >= MIN_LETTERS) {
    if (language === 'ru' && n.cyrillic <= n.latin) {
      return 'story-beat `narration` must be written in Russian (Cyrillic script). Only the narration is translated; all board text stays English.';
    }
    if ((language === 'uz' || language === 'en') && n.cyrillic > n.latin) {
      const want = language === 'uz' ? 'Uzbek (Latin script)' : 'English';
      return `story-beat \`narration\` must be written in ${want}, not Cyrillic.`;
    }
  }

  // Board text is always English (§8.7). Majority-Cyrillic here means a check-in
  // or quiz slipped into the narration language — the known Haiku failure.
  const b = countScripts(boardText(script));
  if (b.cyrillic + b.latin >= MIN_LETTERS && b.cyrillic > b.latin) {
    return 'All written board text — formal beats, check-in questions and options, and the quiz — must be in English. Only story-beat `narration` is in the student’s language.';
  }

  return null;
}
