import { describe, expect, it } from 'vitest';
import { decideAsk } from './detour';
import type { AskResult } from '../api/client';
import type { BoardScript } from './types';

const script: BoardScript = {
  topic_id: 'past_simple',
  level: 'A2',
  beats: [{ id: 1, type: 'formal_beat', style: 'title', content: 'Past Simple' }],
};

describe('decideAsk (§8.5/§8.12)', () => {
  it('routes a lesson for a different topic to a detour', () => {
    const res: AskResult = { kind: 'lesson', topic_id: 'past_simple', board_script: script, cached: false };
    expect(decideAsk(res, 'present_perfect')).toEqual({ action: 'detour', topicId: 'past_simple', boardScript: script });
  });

  it('routes a lesson for the current topic to a replay, not a detour', () => {
    const res: AskResult = { kind: 'lesson', topic_id: 'past_simple', board_script: script, cached: false };
    expect(decideAsk(res, 'past_simple')).toEqual({ action: 'replay', boardScript: script });
  });

  it('routes a re-explanation to an append', () => {
    const res: AskResult = { kind: 'reexplain', beats: script.beats };
    expect(decideAsk(res, 'past_simple')).toEqual({ action: 'reexplain', beats: script.beats });
  });

  it('routes no_content to off_topic', () => {
    expect(decideAsk({ kind: 'no_content' }, 'past_simple')).toEqual({ action: 'off_topic' });
    expect(decideAsk({ kind: 'no_content' }, null)).toEqual({ action: 'off_topic' });
  });
});
