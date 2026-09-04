import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { DOODLE_PATH_DRAW_MS, DOODLE_PATH_STAGGER_MS } from './pacing';
import { fetchSvgText } from './doodleCatalog';

interface Props {
  url: string;
  /** Target display height in px. Width is derived from the SVG's aspect ratio. */
  height: number;
  /** Force a width (used for bubbles, with `stretch`). */
  width?: number;
  /** Stretch to the given width×height instead of preserving aspect (bubbles). */
  stretch?: boolean;
  /** true = draw in stroke by stroke; false = show fully drawn (seek/screenshot). */
  animate: boolean;
  onComplete?: () => void;
}

function aspectRatio(svg: SVGSVGElement): number {
  const vb = svg.viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) return vb.width / vb.height;
  const attr = svg.getAttribute('viewBox');
  if (attr) {
    const parts = attr.split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[3]) return parts[2] / parts[3];
  }
  return 1;
}

/**
 * Renders a doodle SVG inline and draws it in stroke by stroke — for each path,
 * in document order, set stroke-dasharray/offset to the path length then animate
 * the offset to zero (§8.3, §9.1). The SVGs are pre-baked sketchy line art with
 * white strokes; nothing here recolors or reshapes them.
 *
 * Web target only in v1: it manipulates the DOM directly. Native (react-native-svg)
 * is a later phase, so this renders nothing off-web.
 */
export function DoodleSvg({ url, height, width, stretch, animate, onComplete }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [svgText, setSvgText] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchSvgText(url)
      .then((text) => {
        if (active) setSvgText(text);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [url]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || svgText == null) return;

    host.innerHTML = svgText;
    const svg = host.querySelector('svg');
    if (!svg) return;

    const w = width ?? Math.round(height * aspectRatio(svg));
    svg.setAttribute('width', String(w));
    svg.setAttribute('height', String(height));
    svg.style.width = `${w}px`;
    svg.style.height = `${height}px`;
    svg.style.overflow = 'visible';
    if (stretch) svg.setAttribute('preserveAspectRatio', 'none');

    const paths = Array.from(svg.querySelectorAll('path')) as SVGPathElement[];
    let totalMs = 0;

    paths.forEach((path, i) => {
      const len = path.getTotalLength();
      if (!animate) {
        path.style.strokeDasharray = 'none';
        path.style.strokeDashoffset = '0';
        return;
      }
      const delay = i * DOODLE_PATH_STAGGER_MS;
      path.style.strokeDasharray = `${len}`;
      path.style.strokeDashoffset = `${len}`;
      path.style.transition = `stroke-dashoffset ${DOODLE_PATH_DRAW_MS}ms ease ${delay}ms`;
      totalMs = Math.max(totalMs, delay + DOODLE_PATH_DRAW_MS);
    });

    let raf = 0;
    let done = 0;
    if (animate) {
      // Next frame: flip every offset to 0 so the transitions actually run.
      raf = requestAnimationFrame(() => {
        paths.forEach((p) => {
          p.style.strokeDashoffset = '0';
        });
      });
      if (onComplete) done = window.setTimeout(onComplete, totalMs + 50);
    } else if (onComplete) {
      onComplete();
    }

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (done) clearTimeout(done);
    };
    // onComplete intentionally excluded — identity may change per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [svgText, animate, width, height, stretch]);

  if (Platform.OS !== 'web') return null;
  return <div ref={hostRef} style={{ display: 'inline-block', lineHeight: 0 }} />;
}
