import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import {
  baseLayerStyle,
  glowLayerStyle,
  glowMask,
  glowRadius,
  maskCenterY,
} from './grid';

/** Walk up to the nearest scrollable ancestor — the ScrollView's own viewport. */
function scrollParentOf(node: HTMLElement | null): HTMLElement | null {
  let current = node?.parentElement ?? null;
  while (current) {
    const overflowY = window.getComputedStyle(current).overflowY;
    if (
      (overflowY === 'auto' || overflowY === 'scroll') &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

/**
 * The whiteboard's background grid (Part 08 §15).
 *
 * One grid, rendered twice at identical coordinates: a grey layer and a purple
 * copy, both absolutely positioned fills of the scroll content box, both
 * scrolling with the content. Because neither is positioned independently of the
 * other, they are always the same lines — there is no scroll offset at which
 * they can double or drift.
 *
 * The purple copy carries a soft circular mask whose centre is recomputed on
 * every scroll tick, which is what keeps the glow on the middle of the screen.
 * `mask-attachment: fixed` is deliberately NOT used: its WebView support is
 * inconsistent, and Telegram's in-app browser is exactly the engine not to
 * gamble on it with.
 *
 * Extent comes free from Part 03 §4's flex growth — both layers fill the scroll
 * content box, which is the box flex already sizes, so the grid grows with the
 * lesson without a second growth mechanism.
 *
 * Web-only, the same accepted debt `DoodleSvg` and `BixyCharacter` carry.
 */
export function BoardGrid() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const glowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const glow = glowRef.current;
    if (!glow) return;

    const scroller = scrollParentOf(hostRef.current);
    // Coalesce to one update per frame: a scroll event can fire more often than
    // the compositor paints, and the mask only needs to be right once per frame.
    let frame: number | null = null;

    const apply = () => {
      frame = null;
      const height = scroller?.clientHeight ?? window.innerHeight;
      const width = scroller?.clientWidth ?? window.innerWidth;
      const top = scroller?.scrollTop ?? 0;
      const mask = glowMask(maskCenterY(top, height), glowRadius(width, height));
      glow.style.maskImage = mask;
      glow.style.webkitMaskImage = mask;
    };

    const schedule = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(apply);
    };

    apply();
    scroller?.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    // The scroller's height changes as the board grows, not just on a window
    // resize — a new beat can extend the content without any scroll or resize
    // event firing, which would leave the glow sized for the old viewport.
    const observer =
      typeof ResizeObserver === 'function' && scroller ? new ResizeObserver(schedule) : null;
    observer?.observe(scroller!);

    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      scroller?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      observer?.disconnect();
    };
  }, []);

  if (Platform.OS !== 'web') return null;

  return (
    <div ref={hostRef} aria-hidden="true" style={HOST}>
      <div style={{ ...FILL, ...baseLayerStyle() }} />
      {/* Same geometry, same origin — only the stroke colour and the mask differ.
          The mask is set imperatively on mount and on every scroll frame. */}
      <div ref={glowRef} style={{ ...FILL, ...glowLayerStyle() }} />
    </div>
  );
}

const HOST = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  zIndex: 0,
} as const;

const FILL = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
} as const;
