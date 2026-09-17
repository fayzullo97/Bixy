import { describe, expect, it } from 'vitest';
import { buildResumeState } from './resume';
import type { Beat } from './types';

const beats: Beat[] = [
  { id: 1, type: 'formal_beat', style: 'title', term: 'Present Perfect' },
  { id: 2, type: 'story_beat', narration: 'A story.', doodles: [] },
  { id: 3, type: 'story_beat', narration: 'More story.', doodles: [] },
  {
    id: 4,
    type: 'formal_beat',
    style: 'check_in_question',
    question: 'Which one?',
    options: ['a', 'b'],
    correct_index: 1,
  },
  { id: 5, type: 'formal_beat', style: 'formula', formula: 'have/has + pp' },
];

describe('buildResumeState', () => {
  it('resumes from the start when there is no saved beat', () => {
    expect(buildResumeState(beats, null)).toEqual({ doneBeats: [], nextBeatIdx: 0, answeredCheckIns: {} });
    expect(buildResumeState(beats, undefined).nextBeatIdx).toBe(0);
  });

  it('replays up to and including the saved beat, then continues from the next', () => {
    const rs = buildResumeState(beats, 3);
    expect(rs.doneBeats.map((b) => b.id)).toEqual([1, 2, 3]);
    expect(rs.nextBeatIdx).toBe(3); // beats[3] is id 4 — plays next
  });

  it('marks a resumed check-in as already answered (correct, non-interactive)', () => {
    const rs = buildResumeState(beats, 4);
    expect(rs.doneBeats.map((b) => b.id)).toEqual([1, 2, 3, 4]);
    expect(rs.answeredCheckIns).toEqual({ 4: 1 });
    expect(rs.nextBeatIdx).toBe(4);
  });

  it('sends the student into the quiz when the last beat was completed', () => {
    const rs = buildResumeState(beats, 5);
    expect(rs.nextBeatIdx).toBe(beats.length); // past the last beat → quiz pass
  });

  it('falls back to the start when the saved id is not in this script', () => {
    // e.g. the lesson was regenerated with different beat ids.
    expect(buildResumeState(beats, 999)).toEqual({ doneBeats: [], nextBeatIdx: 0, answeredCheckIns: {} });
  });
});
