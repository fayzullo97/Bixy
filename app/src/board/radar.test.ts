import { describe, expect, it } from 'vitest';
import { polygonPoints, spokePoint, spokes, UNTESTED_RADIUS } from './radar';
import { LEVELS } from './levelCheck';

describe('spokes', () => {
  it('has one spoke per placement tier, B1+ included and no C2', () => {
    const s = spokes([]);
    expect(s.map((x) => x.level)).toEqual([...LEVELS]);
    expect(s.map((x) => x.level)).toContain('B1+');
    expect(s.map((x) => x.level)).not.toContain('C2' as never);
  });

  it('scores a tier by its own accuracy', () => {
    const s = spokes([
      { level: 'A1', correct: true },
      { level: 'A1', correct: true },
      { level: 'B1', correct: true },
      { level: 'B1', correct: false },
    ]);
    expect(s.find((x) => x.level === 'A1')).toMatchObject({ value: 1, correct: 2, total: 2 });
    expect(s.find((x) => x.level === 'B1')).toMatchObject({ value: 0.5, correct: 1, total: 2 });
  });

  it('keeps an untested tier just off the centre rather than at zero', () => {
    const s = spokes([{ level: 'A1', correct: true }]);
    expect(s.find((x) => x.level === 'C1')!.value).toBe(UNTESTED_RADIUS);
    expect(s.find((x) => x.level === 'C1')!.total).toBe(0);
  });

  it('distinguishes all-wrong from untested', () => {
    const s = spokes([{ level: 'B2', correct: false }]);
    expect(s.find((x) => x.level === 'B2')).toMatchObject({ value: 0, total: 1 });
    expect(s.find((x) => x.level === 'C1')!.value).toBe(UNTESTED_RADIUS);
  });
});

describe('spokePoint', () => {
  it('puts the first spoke straight up', () => {
    const p = spokePoint(0, 6, 1, 100, 200, 200);
    expect(p.x).toBeCloseTo(200, 6);
    expect(p.y).toBeCloseTo(100, 6);
  });

  it('runs clockwise from the top', () => {
    const p = spokePoint(1, 4, 1, 100, 0, 0);
    expect(p.x).toBeCloseTo(100, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it('scales by the fill and clamps out-of-range values', () => {
    expect(spokePoint(0, 6, 0.5, 100, 0, 0).y).toBeCloseTo(-50, 6);
    expect(spokePoint(0, 6, 2, 100, 0, 0).y).toBeCloseTo(-100, 6);
    expect(spokePoint(0, 6, -1, 100, 0, 0).y).toBeCloseTo(0, 6);
  });
});

describe('polygonPoints', () => {
  it('emits one coordinate pair per value', () => {
    const pts = polygonPoints([1, 1, 1, 1, 1, 1], 100, 200, 200).split(' ');
    expect(pts).toHaveLength(6);
    expect(pts[0]).toBe('200.00,100.00');
  });
});
