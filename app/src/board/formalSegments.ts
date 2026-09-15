import type { ContentFormalBeat } from './types';

/** The corrected sentence in a common_mistake reads green — it's the right answer. */
const CORRECT_COLOR = '#5fd08a';

export interface FormalSegment {
  text: string;
  /** Word highlighted in emphasis blue (§8.3). */
  emphasis?: string;
  /** Overrides the style's colour — used for the corrected sentence. */
  color?: string;
  /**
   * A supporting line sitting under the beat's main content, rendered quieter.
   * Note this is about VISUAL weight, not language: an `explanation` beat's
   * `note` IS its content, so it renders at full weight even though it's the
   * same localized field that reads as secondary under a `formula`.
   */
  secondary?: boolean;
}

/**
 * Decomposes a formal beat into the ordered lines it writes on the board.
 *
 * Single source of truth for the per-style field split (Part 01 §1) on the
 * client: the renderer draws these and pacing measures them, so a new style or
 * field can't drift between how long a beat is shown and what it shows.
 */
export function formalSegments(beat: ContentFormalBeat): FormalSegment[] {
  const trailingNote = (note?: string): FormalSegment[] =>
    note ? [{ text: note, secondary: true }] : [];

  switch (beat.style) {
    case 'title':
      return [{ text: beat.term }];
    case 'formula':
      return [{ text: beat.formula }, ...trailingNote(beat.note)];
    case 'explanation':
      // The note carries the whole beat here — full weight, not a footnote.
      return [{ text: beat.note }];
    case 'example':
      return [{ text: beat.sentence }, ...trailingNote(beat.note)];
    case 'recap_example':
      return [{ text: beat.sentence, emphasis: beat.emphasis }, ...trailingNote(beat.note)];
    case 'common_mistake':
      // Both sides of the pair, then why. v1 wrote only the wrong sentence and
      // left the correction implicit; the split schema makes it explicit.
      return [
        { text: beat.wrong },
        { text: beat.correct, color: CORRECT_COLOR },
        { text: beat.note, secondary: true },
      ];
  }
}

/** Total written length of a formal beat — drives how long it stays on screen. */
export function formalTextLength(beat: ContentFormalBeat): number {
  return formalSegments(beat).reduce((n, seg) => n + seg.text.length, 0);
}
