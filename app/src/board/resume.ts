import type { Beat, CheckInBeat } from './types';

function isCheckIn(beat: Beat): beat is CheckInBeat {
  return beat.type === 'formal_beat' && beat.style === 'check_in_question';
}

export interface ResumeState {
  /** Beats already seen on the first pass, to render instantly as history. */
  doneBeats: Beat[];
  /** Where live playback continues from — an index into `beats`. */
  nextBeatIdx: number;
  /** Pre-answered check-ins among the done beats (beat.id → correct_index) so
   *  resumed history shows them passed and non-interactive. */
  answeredCheckIns: Record<number, number>;
}

const FROM_START: ResumeState = { doneBeats: [], nextBeatIdx: 0, answeredCheckIns: {} };

/**
 * Where to put a student back when they re-open an in-progress topic (§8.9/§9.1).
 * `resumeBeatId` is the saved `last_completed_beat`: we replay everything up to and
 * including it as instant history, then continue live from the next beat — not the
 * top of the topic. A null/undefined id (fresh topic) or one not found in this
 * script (e.g. it was regenerated with different ids) falls back to the start.
 */
export function buildResumeState(
  beats: Beat[],
  resumeBeatId: number | null | undefined,
): ResumeState {
  if (resumeBeatId == null) return FROM_START;
  const idx = beats.findIndex((b) => b.id === resumeBeatId);
  if (idx < 0) return FROM_START;

  const doneBeats = beats.slice(0, idx + 1);
  const answeredCheckIns: Record<number, number> = {};
  for (const beat of doneBeats) {
    if (isCheckIn(beat)) answeredCheckIns[beat.id] = beat.correct_index;
  }
  return { doneBeats, nextBeatIdx: idx + 1, answeredCheckIns };
}
