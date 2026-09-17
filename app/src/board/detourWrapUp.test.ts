import { describe, expect, it } from 'vitest';
import { decideAsk } from './detour';
import type { AskResult } from '../api/client';

const lesson = (topicId: string): AskResult =>
  ({ kind: 'lesson', topic_id: topicId, board_script: { topic_id: topicId, level: 'A2', beats: [] }, cached: false }) as AskResult;

describe('detour routing (Part 04 §13)', () => {
  it('treats a different topic as a detour', () => {
    const d = decideAsk(lesson('past_simple'), 'present_perfect');
    expect(d.action).toBe('detour');
    expect(d.action === 'detour' && d.topicId).toBe('past_simple');
  });

  it('treats the same topic as a replay, not a detour', () => {
    // A replay must not trigger the wrap-up/auto-return path — there is no
    // interrupted topic to return to.
    expect(decideAsk(lesson('present_perfect'), 'present_perfect').action).toBe('replay');
  });

  it('treats a topic asked with no active topic as a detour', () => {
    expect(decideAsk(lesson('past_simple'), null).action).toBe('detour');
  });

  it('routes a follow-up to re-explanation, never a detour', () => {
    expect(decideAsk({ kind: 'reexplain', beats: [] } as AskResult, 'present_perfect').action).toBe('reexplain');
  });

  it('surfaces off-topic plainly', () => {
    expect(decideAsk({ kind: 'no_content' } as AskResult, 'present_perfect').action).toBe('off_topic');
  });
});
