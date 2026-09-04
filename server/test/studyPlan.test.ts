import { describe, expect, it } from 'vitest';
import { buildStudyPlan, familyOf, type PlanTopic } from '../src/modules/study-plan/buildPlan';
import { advancedPosition, currentTopicId, levelStats } from '../src/modules/study-plan/plan';
import { greetingVariant } from '../src/modules/study-plan/greeting';

const TOPICS: PlanTopic[] = [
  { topic_id: 'present_simple_be', level: 'A1', sort_order: 0 },
  { topic_id: 'articles_a_an', level: 'A1', sort_order: 1 },
  { topic_id: 'present_simple', level: 'A1', sort_order: 2 }, // same family as _be, authored later
  { topic_id: 'past_simple', level: 'A2', sort_order: 3 },
  { topic_id: 'superlative_adjectives', level: 'A2', sort_order: 4 }, // authored BEFORE comparative
  { topic_id: 'comparative_adjectives', level: 'A2', sort_order: 5 },
  { topic_id: 'present_perfect', level: 'B1', sort_order: 6 },
];

describe('familyOf', () => {
  it('is the first token of the topic_id', () => {
    expect(familyOf('present_simple_be')).toBe('present');
    expect(familyOf('comparative_adjectives')).toBe('comparative');
    expect(familyOf('demonstratives')).toBe('demonstratives'); // no underscore
  });
});

describe('buildStudyPlan', () => {
  it('starts at the placement tier and walks upward, never below it', () => {
    const plan = buildStudyPlan('A2', TOPICS);
    expect(plan).toEqual([
      'past_simple',
      'comparative_adjectives', // pin: comparative before superlative
      'superlative_adjectives',
      'present_perfect', // B1, above A2
    ]);
    expect(plan).not.toContain('present_simple_be'); // A1 is below A2 — excluded
  });

  it('groups a family together, even when it reorders authored position', () => {
    // present_simple (authored #2) is pulled up under present_simple_be (#0),
    // ahead of articles_a_an (#1): one family at a time within a level.
    expect(buildStudyPlan('A1', TOPICS).slice(0, 3)).toEqual([
      'present_simple_be',
      'present_simple',
      'articles_a_an',
    ]);
  });

  it('honors a family pin regardless of authored order', () => {
    const a2 = buildStudyPlan('A2', TOPICS).filter((id) => id.endsWith('_adjectives'));
    expect(a2).toEqual(['comparative_adjectives', 'superlative_adjectives']);
  });

  it('places a student at the top tier with only that tier', () => {
    expect(buildStudyPlan('B1', TOPICS)).toEqual(['present_perfect']);
  });
});

describe('currentTopicId', () => {
  it('returns the first not-yet-passed topic from the position', () => {
    expect(currentTopicId(['a', 'b', 'c'], 0, new Set())).toBe('a');
    expect(currentTopicId(['a', 'b', 'c'], 0, new Set(['a']))).toBe('b');
    expect(currentTopicId(['a', 'b', 'c'], 1, new Set(['b']))).toBe('c'); // skip passed
  });

  it('returns null when the path is complete', () => {
    expect(currentTopicId(['a', 'b'], 0, new Set(['a', 'b']))).toBeNull();
  });
});

describe('advancedPosition', () => {
  it('advances past the current topic when it is cleared', () => {
    expect(advancedPosition(['a', 'b', 'c'], 0, new Set(), 'a')).toBe(1);
  });

  it('does not move for a detour (a pass of a non-current topic)', () => {
    expect(advancedPosition(['a', 'b', 'c'], 0, new Set(), 'b')).toBe(0);
  });
});

describe('levelStats', () => {
  it('counts passed topics at the level out of the level total', () => {
    const passed = new Set(['present_simple_be', 'past_simple']);
    expect(levelStats('A1', TOPICS, passed)).toEqual({ level: 'A1', completed: 1, total: 3 });
  });
});

describe('greetingVariant', () => {
  it('is full when never greeted', () => {
    expect(greetingVariant(null)).toBe('full');
  });

  it('is short for a repeat visit the same day', () => {
    const now = new Date('2026-08-31T18:00:00Z');
    expect(greetingVariant('2026-08-31T09:00:00Z', now)).toBe('short');
  });

  it('is full again on a later day', () => {
    const now = new Date('2026-09-01T06:00:00Z');
    expect(greetingVariant('2026-08-31T23:00:00Z', now)).toBe('full');
  });
});
