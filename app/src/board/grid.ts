/**
 * The whiteboard's endless background grid (Part 08 §15).
 *
 * **One grid, rendered twice at identical coordinates.** Both layers are
 * absolutely positioned fills of the SAME scroll content box, painting the same
 * repeating tile at the same origin, and both scroll with the content. They are
 * never independently positioned, so they cannot drift: whatever transform the
 * grey lines get, the purple lines get too, pixel for pixel.
 *
 * The purple copy is masked by a soft circular gradient, so only the lines near
 * the mask show through in purple. The mask's centre is tracked by a scroll
 * listener (`scrollTop + clientHeight / 2`) rather than by pinning anything:
 * `mask-attachment: fixed` has inconsistent WebView support, and Telegram's
 * in-app browser is not the engine to gamble on it with. Recomputing the centre
 * keeps the glow anchored to the middle of the screen while the grid scrolls
 * underneath, with no second positioned element anywhere.
 *
 * **Why extent needs no growth mechanism of its own.** Part 03 §4's board cursor
 * is flex layout, not a measured cursor: scenes are `alignSelf: 'stretch'` with
 * a `marginBottom: 50` spacer, and the scroll content's height is whatever that
 * sums to. Both layers are painted on that same box, so they grow in exact
 * lockstep with it — no second mechanism, and nothing to keep in sync.
 */

/** Grid pitch in px. Uniform on both axes. */
export const TILE = 32;

/** The base grid's stroke: light grey on the board's dark ground. */
export const GRID_STROKE = 'rgba(255, 255, 255, 0.07)';

/** The masked copy's stroke, before the gradient fades it toward the edges. */
export const GLOW_STROKE = 'rgba(155, 120, 255, 0.55)';

/** Spotlight radius as a share of the viewport's smaller side. */
export const GLOW_RADIUS_RATIO = 0.68;

/**
 * A repeating grid as two CSS linear-gradients (one per axis).
 *
 * Gradients rather than an SVG tile: a gradient pair repeats natively via
 * `background-repeat` at any size, so there is no image to run out and nothing
 * to regenerate when the board grows.
 */
export function gridImage(stroke: string, thickness = 1): string {
  const line = `${stroke} 0 ${thickness}px, transparent ${thickness}px 100%`;
  return `linear-gradient(to right, ${line}), linear-gradient(to bottom, ${line})`;
}

export interface LayerStyle {
  backgroundImage: string;
  backgroundSize: string;
  backgroundRepeat: string;
  backgroundPosition: string;
}

/** The shared geometry of both layers — identical by construction. */
function layer(stroke: string, tile: number): LayerStyle {
  return {
    backgroundImage: gridImage(stroke),
    backgroundSize: `${tile}px ${tile}px`,
    backgroundRepeat: 'repeat',
    backgroundPosition: '0 0',
  };
}

/** The grey layer. Scrolls with the content, like any painted background. */
export function baseLayerStyle(tile: number = TILE): LayerStyle {
  return layer(GRID_STROKE, tile);
}

/** The purple copy — same geometry, same origin, different stroke. */
export function glowLayerStyle(tile: number = TILE): LayerStyle {
  return layer(GLOW_STROKE, tile);
}

/**
 * Whether the two layers coincide: same tile, same repeat, same origin. Exposed
 * so the property §15 depends on is asserted rather than assumed — the layers
 * being built by two functions is exactly how they'd drift apart later.
 */
export function layersCoincide(a: LayerStyle, b: LayerStyle): boolean {
  return (
    a.backgroundSize === b.backgroundSize &&
    a.backgroundRepeat === b.backgroundRepeat &&
    a.backgroundPosition === b.backgroundPosition
  );
}

/** Spotlight radius in px for a viewport of the given size. */
export function glowRadius(viewportWidth: number, viewportHeight: number): number {
  const smaller = Math.min(
    Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 0,
    Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 0,
  );
  return Math.round(Math.max(smaller, 1) * GLOW_RADIUS_RATIO);
}

/**
 * The mask centre, in the layer's own coordinate space.
 *
 * The layer spans the whole scroll content, so the middle of the screen sits at
 * `scrollTop + clientHeight / 2` within it. This is the value the scroll handler
 * recomputes on every tick; it is what replaces a `fixed` attachment.
 */
export function maskCenterY(scrollTop: number, viewportHeight: number): number {
  const top = Number.isFinite(scrollTop) ? Math.max(0, scrollTop) : 0;
  const height = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : 0;
  return top + height / 2;
}

/**
 * The radial mask that keeps the glow centred on the screen (§15). Horizontally
 * centred on the layer; vertically placed at the tracked centre.
 */
export function glowMask(centerY: number, radius: number): string {
  const r = Math.max(1, Math.round(radius));
  const y = Math.round(centerY);
  return `radial-gradient(circle ${r}px at 50% ${y}px, #000 0%, rgba(0,0,0,0.55) 55%, transparent 100%)`;
}
