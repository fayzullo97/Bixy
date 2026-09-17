import { describe, expect, it } from 'vitest';
import {
  GLOW_RADIUS_RATIO,
  TILE,
  baseLayerStyle,
  glowLayerStyle,
  glowMask,
  glowRadius,
  gridImage,
  layersCoincide,
  maskCenterY,
} from './grid';

describe('gridImage', () => {
  it('builds one repeating line per axis', () => {
    const image = gridImage('red');
    expect(image.match(/linear-gradient/g)).toHaveLength(2);
    expect(image).toContain('to right');
    expect(image).toContain('to bottom');
  });

  it('carries the stroke colour and thickness through', () => {
    expect(gridImage('rgba(1,2,3,0.4)', 2)).toContain('rgba(1,2,3,0.4) 0 2px');
  });
});

describe('the two layers', () => {
  it('coincide — same tile, repeat and origin, so they are always the same lines', () => {
    expect(layersCoincide(baseLayerStyle(), glowLayerStyle())).toBe(true);
  });

  it('still coincide at a non-default tile size', () => {
    expect(layersCoincide(baseLayerStyle(48), glowLayerStyle(48))).toBe(true);
  });

  it('are detected as drifting apart when the tile sizes differ', () => {
    expect(layersCoincide(baseLayerStyle(32), glowLayerStyle(48))).toBe(false);
  });

  it('share an origin, which is what stops them doubling', () => {
    expect(baseLayerStyle().backgroundPosition).toBe('0 0');
    expect(glowLayerStyle().backgroundPosition).toBe(baseLayerStyle().backgroundPosition);
  });

  it('pin nothing — neither layer opts out of scrolling with the content', () => {
    // A `fixed` attachment on either layer is what the corrected mechanism
    // removes; both must scroll with the content so they stay identical.
    expect(Object.keys(baseLayerStyle())).not.toContain('backgroundAttachment');
    expect(Object.keys(glowLayerStyle())).not.toContain('backgroundAttachment');
  });

  it('differ only in stroke colour', () => {
    const base = baseLayerStyle();
    const glow = glowLayerStyle();
    expect(base.backgroundImage).not.toBe(glow.backgroundImage);
    expect(base.backgroundSize).toBe(glow.backgroundSize);
  });

  it('repeat at the documented pitch by default', () => {
    expect(baseLayerStyle().backgroundSize).toBe(`${TILE}px ${TILE}px`);
  });
});

describe('maskCenterY', () => {
  it('is the middle of the screen expressed in the layer’s own space', () => {
    expect(maskCenterY(0, 800)).toBe(400);
    expect(maskCenterY(1200, 800)).toBe(1600);
  });

  it('tracks scroll one-for-one, so the glow holds still on screen', () => {
    const a = maskCenterY(500, 900);
    const b = maskCenterY(700, 900);
    expect(b - a).toBe(200);
  });

  it('survives a missing or nonsensical measurement', () => {
    expect(maskCenterY(-50, 800)).toBe(400);
    expect(maskCenterY(NaN, 800)).toBe(400);
    expect(maskCenterY(100, 0)).toBe(100);
  });
});

describe('glowRadius', () => {
  it('scales with the viewport’s smaller side', () => {
    expect(glowRadius(1000, 500)).toBe(Math.round(500 * GLOW_RADIUS_RATIO));
    expect(glowRadius(400, 900)).toBe(Math.round(400 * GLOW_RADIUS_RATIO));
  });

  it('never returns a degenerate radius', () => {
    expect(glowRadius(0, 0)).toBeGreaterThan(0);
    expect(glowRadius(NaN, NaN)).toBeGreaterThan(0);
  });
});

describe('glowMask', () => {
  it('centres horizontally and places the tracked centre vertically', () => {
    expect(glowMask(1600, 540)).toContain('at 50% 1600px');
    expect(glowMask(1600, 540)).toContain('circle 540px');
  });

  it('fades to fully transparent so the glow has no visible edge', () => {
    expect(glowMask(0, 500)).toContain('transparent 100%');
  });

  it('emits integers, so no sub-pixel churn per scroll frame', () => {
    expect(glowMask(1600.4, 539.6)).toContain('at 50% 1600px');
    expect(glowMask(1600.4, 539.6)).toContain('circle 540px');
  });
});
