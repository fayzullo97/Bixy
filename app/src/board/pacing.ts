import type { Beat } from './types';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * How long a beat stays "active" before the player advances. In v1 there's no
 * TTS yet (Phase 4), so pacing is derived from text length as a stand-in for
 * narration duration — §8.3 allows visual pacing tied to narration length.
 * Real audio duration will drive this later.
 */
export function beatDurationMs(beat: Beat): number {
  if (beat.type === 'story_beat') {
    return clamp(1400 + beat.narration.length * 45, 2200, 9000);
  }
  if (beat.style === 'check_in_question') {
    return clamp(2600 + beat.question.length * 30, 3600, 9000);
  }
  return clamp(1200 + beat.content.length * 55, 1800, 7000);
}

/** Per-path draw time for a doodle, and the stagger between successive paths. */
export const DOODLE_PATH_DRAW_MS = 420;
export const DOODLE_PATH_STAGGER_MS = 90;

/** Per-word stagger for the formal-text reveal (word-by-word, uneven feel). */
export const WORD_REVEAL_STAGGER_MS = 70;
