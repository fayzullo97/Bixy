import type { Beat } from './types';

/**
 * §9.2 re-explanation variant seam. When a student gets a check-in wrong, the
 * board re-teaches that part of the lesson — ideally with a *different* stored
 * variant, so they aren't shown the identical content they just couldn't follow.
 * The cross-student variant pool is fed by re-explanation requests, which arrive
 * with the bottom input control in a later phase; until then the pool is empty
 * and this returns the same segment. Isolated here so wiring the pool in later is
 * a single-function change, not a hunt through the renderer.
 */
export function pickReTeachVariant(segment: Beat[]): Beat[] {
  return segment;
}
