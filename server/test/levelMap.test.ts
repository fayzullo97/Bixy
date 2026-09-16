import { describe, expect, it } from 'vitest';
import {
  autoScrollIndex,
  levelSummaries,
  levelTopics,
  topicStatus,
  type LevelTopicRow,
} from '../src/modules/levels/levelMap.js';

const rows: LevelTopicRow[] = [
  { topic_id: 'a1_one', level: 'A1', sort_order: 1, key_idea: 'One.' },
  { topic_id: 'a1_two', level: 'A1', sort_order: 2, key_idea: 'Two.' },
  { topic_id: 'a1_three', level: 'A1', sort_order: 3, key_idea: 'Three.' },
  { topic_id: 'a2_one', level: 'A2', sort_order: 4, key_idea: 'Four.' },
];

describe('topicStatus', () => {
  const passed = new Set(['a1_one']);
  const started = new Set(['a1_three']);

  it('reports a cleared topic as passed', () => {
    expect(topicStatus('a1_one', 'a1_two', passed, started)).toBe('passed');
  });

  it('reports the served topic as current', () => {
    expect(topicStatus('a1_two', 'a1_two', passed, started)).toBe('current');
  });

  it('keeps an abandoned started topic openable rather than locking it', () => {
    expect(topicStatus('a1_three', 'a1_two', passed, started)).toBe('started');
  });

  it('locks a topic past the frontier', () => {
    expect(topicStatus('a2_one', 'a1_two', passed, started)).toBe('locked');
  });

  it('passed wins over current when both would apply', () => {
    expect(topicStatus('a1_one', 'a1_one', passed, started)).toBe('passed');
  });
});

describe('levelSummaries', () => {
  it('counts passed topics per tier', () => {
    const s = levelSummaries(rows, new Set(['a1_one', 'a1_two']), 'A1');
    const a1 = s.find((x) => x.level === 'A1')!;
    expect(a1).toMatchObject({ completed: 2, total: 3, status: 'in_progress' });
  });

  it('marks a tier completed only when every topic is passed', () => {
    const s = levelSummaries(rows, new Set(['a1_one', 'a1_two', 'a1_three']), 'A1');
    expect(s.find((x) => x.level === 'A1')!.status).toBe('completed');
  });

  it("treats the student's own placement as in progress even with nothing passed", () => {
    const s = levelSummaries(rows, new Set(), 'A2');
    expect(s.find((x) => x.level === 'A2')!.status).toBe('in_progress');
    expect(s.find((x) => x.level === 'A1')!.status).toBe('not_started');
  });

  it('returns every tier, including ones with no topics loaded', () => {
    const s = levelSummaries(rows, new Set(), null);
    expect(s.map((x) => x.level)).toEqual(['A1', 'A2', 'B1', 'B1+', 'B2', 'C1']);
    expect(s.find((x) => x.level === 'C1')).toMatchObject({ total: 0, status: 'not_started' });
  });

  it('does not call an empty tier completed', () => {
    const s = levelSummaries(rows, new Set(), null);
    expect(s.find((x) => x.level === 'B2')!.status).toBe('not_started');
  });
});

describe('levelTopics', () => {
  it("orders by the student's own plan where the tier appears in it", () => {
    const view = levelTopics('A1', rows, ['a1_three', 'a1_one', 'a1_two'], 'a1_one', new Set(), new Set());
    expect(view.map((t) => t.topic_id)).toEqual(['a1_three', 'a1_one', 'a1_two']);
  });

  it('falls back to authored order for a tier below the placement', () => {
    const view = levelTopics('A1', rows, ['a2_one'], 'a2_one', new Set(), new Set());
    expect(view.map((t) => t.topic_id)).toEqual(['a1_one', 'a1_two', 'a1_three']);
  });

  it('carries each topic status and key idea', () => {
    const view = levelTopics('A1', rows, [], 'a1_two', new Set(['a1_one']), new Set());
    expect(view[0]).toMatchObject({ topic_id: 'a1_one', status: 'passed', key_idea: 'One.' });
    expect(view[1]).toMatchObject({ topic_id: 'a1_two', status: 'current' });
    expect(view[2]!.status).toBe('locked');
  });
});

describe('autoScrollIndex', () => {
  const view = levelTopics('A1', rows, [], 'a1_three', new Set(['a1_one', 'a1_two']), new Set());

  it("scrolls the student's current level to their position", () => {
    expect(autoScrollIndex('A1', 'A1', view)).toBe(2);
  });

  it('does not scroll a level that is not the current one', () => {
    expect(autoScrollIndex('A1', 'A2', view)).toBeNull();
    expect(autoScrollIndex('A1', null, view)).toBeNull();
  });

  it('does not scroll when the tier has no in-progress position', () => {
    const done = levelTopics('A1', rows, [], null, new Set(['a1_one', 'a1_two', 'a1_three']), new Set());
    expect(autoScrollIndex('A1', 'A1', done)).toBeNull();
  });
});
