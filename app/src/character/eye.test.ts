import { describe, expect, it } from 'vitest';
import { blinkTransform, eyeLineFromPath, eyePath, eyePathData, eyePathForGaze } from './eye';
import { cubicPointAt, parsePath, pathStructure, serializePath, subdividePath } from './path';
import { GAZE_BOW } from './gaze';

const line = { from: { x: 80, y: 90 }, to: { x: 104, y: 90 } };

describe('gaze-curved eye (Part 06 §10)', () => {
  it('reproduces the straight source art EXACTLY at front gaze', () => {
    // Not "close to straight" — the asset was redrawn straight specifically so
    // a bow of 0 is the art itself.
    const straight = subdividePath(parsePath('M80 90 L104 90'));
    expect(eyePathData(line, 0)).toBe(serializePath(straight));
  });

  it('curves to one side or the other by the sign of the bow', () => {
    const left = eyePath(line, -3.5);
    const right = eyePath(line, 3.5);
    const midLeft = left[1]!.values[5]!;
    const midRight = right[1]!.values[5]!;
    expect(midLeft).toBeLessThan(90);
    expect(midRight).toBeGreaterThan(90);
    // Symmetric by construction — the old translation-only approach was not.
    expect(90 - midLeft).toBeCloseTo(midRight - 90, 9);
  });

  it('keeps the eye endpoints pinned wherever it bows', () => {
    for (const bow of [-3.5, 0, 2.5, 3.5]) {
      const path = eyePath(line, bow);
      expect(path[0]!.values).toEqual([80, 90]);
      expect(path[2]!.values.slice(4)).toEqual([104, 90]);
    }
  });

  it('stays two segments at every gaze direction, so it can still morph', () => {
    // Angry-Morph needs this structure whatever the last glance left behind.
    for (const direction of ['front', 'left', 'right', 'top_left', 'top_right'] as const) {
      expect(pathStructure(eyePathForGaze(line, direction))).toBe('MCC');
    }
  });

  it('bows across the eye even when the eye is angled', () => {
    const angled = { from: { x: 0, y: 0 }, to: { x: 0, y: 24 } };
    const path = eyePath(angled, 4);
    // A vertical eye bows horizontally — the offset is perpendicular, not
    // always vertical.
    expect(path[1]!.values[4]).toBeCloseTo(-4 * 0.75, 5);
  });

  it('matches the gaze table', () => {
    expect(serializePath(eyePathForGaze(line, 'left'))).toBe(serializePath(eyePath(line, GAZE_BOW.left)));
  });

  it('survives a degenerate zero-length eye instead of producing NaN', () => {
    const point = { from: { x: 10, y: 10 }, to: { x: 10, y: 10 } };
    const data = eyePathData(point, 3);
    expect(data).not.toContain('NaN');
  });

  it('traces the same curve the single cubic would, after subdivision', () => {
    const bowed = eyePath(line, 3.5);
    const midpoint = cubicPointAt(
      { x: 80, y: 90 },
      { x: 88, y: 93.5 },
      { x: 96, y: 93.5 },
      { x: 104, y: 90 },
      0.5,
    );
    expect(bowed[1]!.values[4]).toBeCloseTo(midpoint.x, 9);
    expect(bowed[1]!.values[5]).toBeCloseTo(midpoint.y, 9);
  });
});

describe('reading an eye out of its asset (Part 06 §10)', () => {
  it('recovers the endpoints of a straight eye', () => {
    expect(eyeLineFromPath('M80 90 L104 90')).toEqual(line);
  });

  it('recovers them from a curved eye too', () => {
    expect(eyeLineFromPath('M80 90 C88 94 96 94 104 90')).toEqual(line);
  });

  it('refuses a path it cannot read as an eye', () => {
    expect(() => eyeLineFromPath('M80 90')).toThrow(/moves then draws/);
  });
});

describe('blink (Part 06 §10)', () => {
  it('does nothing at rest', () => {
    expect(blinkTransform(line, 0)).toContain('scale(1 1)');
  });

  it('squashes around the eye’s OWN center, not the face’s', () => {
    // Otherwise both eyes slide toward the middle of the face as they close.
    expect(blinkTransform(line, 1)).toContain('translate(0 90)');
  });

  it('never scales to exactly zero, which would erase the stroke', () => {
    expect(blinkTransform(line, 1)).not.toContain('scale(1 0)');
  });
});
