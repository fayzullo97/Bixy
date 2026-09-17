import { describe, expect, it } from 'vitest';
import { pickScoreReaction } from './scoreReaction';
import type { BoardScript } from './types';

const script = (over: Partial<BoardScript> = {}): BoardScript =>
  ({
    topic_id: 't',
    level: 'A2',
    beats: [],
    score_reactions: {
      reteach_all: ['Hmm, {score}% — from the top.', 'Only {score}% this time.', '{score}%. Whole thing again.'],
      reteach_missed: ['{score}% — close!', 'Nearly: {score}%.'],
    },
    ...over,
  }) as BoardScript;

describe('pickScoreReaction (Part 04 §6)', () => {
  it('substitutes the score into the phrasing', () => {
    expect(pickScoreReaction(script(), 'reteach_missed', 67, 0)).toBe('67% — close!');
  });

  it('picks from the tier that matches the outcome', () => {
    expect(pickScoreReaction(script(), 'reteach_all', 40, 0)).toBe('Hmm, 40% — from the top.');
  });

  it('rotates by round, so a repeat failure is not phrased identically', () => {
    const s = script();
    expect(pickScoreReaction(s, 'reteach_all', 40, 0)).not.toBe(pickScoreReaction(s, 'reteach_all', 40, 1));
    expect(pickScoreReaction(s, 'reteach_all', 40, 1)).toBe('Only 40% this time.');
  });

  it('wraps around rather than running out', () => {
    expect(pickScoreReaction(script(), 'reteach_all', 40, 3)).toBe('Hmm, 40% — from the top.');
    expect(pickScoreReaction(script(), 'reteach_missed', 55, 2)).toBe('55% — close!');
  });

  it('replaces every occurrence of the token', () => {
    const s = script({ score_reactions: { reteach_all: ['{score}% … yes, {score}%.'], reteach_missed: [] } });
    expect(pickScoreReaction(s, 'reteach_all', 30, 0)).toBe('30% … yes, 30%.');
  });

  it('returns null when the tier is empty, so the board can fall back', () => {
    const s = script({ score_reactions: { reteach_all: [], reteach_missed: ['x'] } });
    expect(pickScoreReaction(s, 'reteach_all', 40, 0)).toBeNull();
  });

  it('returns null for a script generated before score_reactions existed', () => {
    expect(pickScoreReaction(script({ score_reactions: undefined }), 'reteach_all', 40, 0)).toBeNull();
  });
});
