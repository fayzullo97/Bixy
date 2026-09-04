import { describe, expect, it } from 'vitest';
import {
  decideNext,
  finalPlacement,
  pickQuestion,
  HARD_CAP,
  LEVELS,
  SKIP_LEVEL,
  type Answered,
  type Level,
} from './levelCheck';

/**
 * Drive the algorithm end-to-end for a perfectly consistent student who answers
 * correctly on exactly the levels at or below `trueLevel` (and wrong above it).
 * Placement should land on the first level above their real competence — the
 * lowest level they don't clearly clear (§8.11).
 */
function simulate(trueLevel: Level | 'none'): { asks: Level[]; placement: Level } {
  const ceiling = trueLevel === 'none' ? -1 : LEVELS.indexOf(trueLevel);
  const answered: Answered[] = [];
  const asks: Level[] = [];
  for (let guard = 0; guard <= HARD_CAP + 1; guard++) {
    const decision = decideNext(answered);
    if (decision.kind === 'place') return { asks, placement: decision.level };
    asks.push(decision.level);
    answered.push({ level: decision.level, correct: LEVELS.indexOf(decision.level) <= ceiling });
  }
  throw new Error('did not terminate within the hard cap');
}

describe('decideNext — opening round', () => {
  it('asks A1, then B1, then C1 as the coarse low/mid/high read', () => {
    expect(decideNext([])).toEqual({ kind: 'ask', level: 'A1' });
    expect(decideNext([{ level: 'A1', correct: true }])).toEqual({ kind: 'ask', level: 'B1' });
    expect(
      decideNext([
        { level: 'A1', correct: true },
        { level: 'B1', correct: false },
      ]),
    ).toEqual({ kind: 'ask', level: 'C1' });
  });
});

describe('decideNext — placement for a consistent student', () => {
  it.each([
    ['none', 'A1'], // fails everything → floor
    ['A1', 'A2'],
    ['A2', 'B1'],
    ['B1', 'B1+'],
    ['B1+', 'B2'],
    ['B2', 'C1'],
    ['C1', 'C1'], // clears everything → ceiling
  ] as Array<[Level | 'none', Level]>)(
    'places a student who clears through %s at %s',
    (trueLevel, expected) => {
      const { placement, asks } = simulate(trueLevel);
      expect(placement).toBe(expected);
      expect(asks.length).toBeLessThanOrEqual(HARD_CAP);
    },
  );

  it('starts every attempt with the three opening reads', () => {
    expect(simulate('B1').asks.slice(0, 3)).toEqual(['A1', 'B1', 'C1']);
  });
});

describe('decideNext — mixed pair (1/2) evaluates 4 total', () => {
  // Opening A1✓ B1✓ C1✗ seeds the pair search at B2.
  const opening: Answered[] = [
    { level: 'A1', correct: true },
    { level: 'B1', correct: true },
    { level: 'C1', correct: false },
  ];

  it('asks two more at the same level after a 1/2 split', () => {
    const mixed = [...opening, { level: 'B2' as Level, correct: true }, { level: 'B2' as Level, correct: false }];
    expect(decideNext(mixed)).toEqual({ kind: 'ask', level: 'B2' });
    // third answer, still short of 4 → keep asking the same level
    expect(decideNext([...mixed, { level: 'B2', correct: true }])).toEqual({ kind: 'ask', level: 'B2' });
  });

  it('early-stops and places when the 4 sit at 40–60% (2/4)', () => {
    const twoOfFour: Answered[] = [
      ...opening,
      { level: 'B2', correct: true },
      { level: 'B2', correct: false },
      { level: 'B2', correct: true },
      { level: 'B2', correct: false },
    ];
    expect(decideNext(twoOfFour)).toEqual({ kind: 'place', level: 'B2' });
  });

  it('resolves up on a clear majority (3/4)', () => {
    const threeOfFour: Answered[] = [
      ...opening,
      { level: 'B2', correct: true },
      { level: 'B2', correct: false },
      { level: 'B2', correct: true },
      { level: 'B2', correct: true },
    ];
    expect(decideNext(threeOfFour)).toEqual({ kind: 'ask', level: 'C1' });
  });
});

describe('decideNext — hard cap', () => {
  it('stops at HARD_CAP questions and places via the final-placement rule', () => {
    // Seed A2 (A1✓ B1✗ C1✗), then climb with 3/4 majorities so the search keeps
    // stepping up without resolving a boundary — 15 answers, still mid-search.
    const climb3of4 = (level: Level): Answered[] => [
      { level, correct: true },
      { level, correct: false },
      { level, correct: true },
      { level, correct: true },
    ];
    const answered: Answered[] = [
      { level: 'A1', correct: true },
      { level: 'B1', correct: false },
      { level: 'C1', correct: false },
      ...climb3of4('A2'),
      ...climb3of4('B1'),
      ...climb3of4('B1+'),
    ];
    expect(answered).toHaveLength(HARD_CAP);
    const decision = decideNext(answered);
    expect(decision.kind).toBe('place');
    expect(LEVELS).toContain((decision as { level: Level }).level);
  });
});

describe('finalPlacement', () => {
  it('places at the first tested level below the pass threshold, walking up', () => {
    expect(
      finalPlacement([
        { level: 'A1', correct: true },
        { level: 'A1', correct: true },
        { level: 'B1', correct: false },
        { level: 'B1', correct: true },
      ]),
    ).toBe('B1'); // A1 100% cleared, B1 50% not
  });

  it('places at the highest tested level when everything tested is cleared', () => {
    expect(
      finalPlacement([
        { level: 'A1', correct: true },
        { level: 'A2', correct: true },
      ]),
    ).toBe('A2');
  });
});

describe('pickQuestion', () => {
  const bank = [
    { id: 'a1_1', level: 'A1' },
    { id: 'a1_2', level: 'A1' },
    { id: 'b1_1', level: 'B1' },
  ];

  it('prefers a question the student has not seen', () => {
    const q = pickQuestion('A1', bank, new Set(['a1_1']), new Set());
    expect(q?.id).toBe('a1_2');
  });

  it('never repeats one used this attempt, falling back to a seen question', () => {
    const q = pickQuestion('A1', bank, new Set(['a1_1']), new Set(['a1_2']));
    expect(q?.id).toBe('a1_1'); // only a1_1 left, even though it's been seen before
  });

  it('returns null when a level has no available question', () => {
    expect(pickQuestion('C1', bank, new Set(), new Set())).toBeNull();
    expect(pickQuestion('A1', bank, new Set(), new Set(['a1_1', 'a1_2']))).toBeNull();
  });
});

describe('SKIP_LEVEL', () => {
  it('is the floor level A1', () => {
    expect(SKIP_LEVEL).toBe('A1');
  });
});
