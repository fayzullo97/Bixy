import type { Beat, BoardScript, SpokenUnit } from './boardScript.js';
import type { Language } from './systemPrompt.js';

/**
 * What a beat says out loud, in board order (Part 02 §5).
 *
 * Derived from the beat's own fields rather than asked of the model: the spoken
 * text is exactly the written text, so the two can never drift, and generation
 * gains no new way to fail. Each unit carries its own language because Part 01
 * §1 split formal beats per-field — an English `sentence` sits beside a
 * localized `note` in one beat, and they need different TTS providers.
 *
 * `language` is the EFFECTIVE content language (`contentLanguage(level,
 * appLanguage)`), so at C1 every unit here is English.
 *
 * Deliberately silent (Part 02 §5):
 *  - check-in `options` — the stem is voiced, the choices stay text-only
 *  - `emphasis` — a marker inside a sentence already voiced, not its own line
 *  - the end-of-topic test — different register from the lesson
 */
export function spokenUnits(beat: Beat, language: Language): SpokenUnit[] {
  const en = (text: string): SpokenUnit => ({ text, language: 'en' });
  const local = (text: string): SpokenUnit => ({ text, language });

  if (beat.type === 'story_beat') {
    return beat.narration.trim() ? [local(beat.narration)] : [];
  }

  switch (beat.style) {
    case 'title':
      return [en(beat.term)];
    case 'formula':
      return [en(beat.formula), ...(beat.note ? [local(beat.note)] : [])];
    case 'explanation':
      return [local(beat.note)];
    case 'example':
      return [en(beat.sentence), ...(beat.note ? [local(beat.note)] : [])];
    case 'recap_example':
      return [en(beat.sentence), ...(beat.note ? [local(beat.note)] : [])];
    case 'common_mistake':
      // Both sides are voiced, not just the fix (Part 02 §5) — hearing the wrong
      // form said aloud next to the right one is the point of the pair.
      return [en(beat.wrong), en(beat.correct), local(beat.note)];
    case 'check_in_question':
      return [en(beat.question)];
  }
}

/** The lesson's spoken units in playback order, including the quiz transition. */
export function scriptSpokenUnits(
  script: BoardScript,
  language: Language,
): Array<{ owner: Beat | 'quiz_intro'; units: SpokenUnit[] }> {
  const out = script.beats.map((beat) => ({ owner: beat as Beat | 'quiz_intro', units: spokenUnits(beat, language) }));
  if (script.quiz_intro?.trim()) {
    out.push({ owner: 'quiz_intro', units: [{ text: script.quiz_intro, language }] });
  }
  return out;
}
