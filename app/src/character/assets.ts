/**
 * Bixy's path data and tuned constants (Part 06 §10).
 *
 * Extracted verbatim from the browser-verified reference implementation,
 * `docs/reference/bixy-animation-preview-v2.html`, which §10 names as the
 * canonical source for exact values. Nothing here is re-derived from the source
 * SVGs or from the prose: an earlier pass that did exactly that produced nine
 * divergences from the verified behaviour, several of them wrong rather than
 * merely differently tuned.
 *
 * The calm coordinates below are ALREADY shifted +2,+1 onto the angry canvas
 * (241×191 vs 245×193), so calm and angry can be interpolated directly. The
 * viewBox is the angry canvas.
 */

export const VIEW_BOX = "0 0 245 193";

/** Body: identical structure to its angry counterpart (M + 14×C + Z, 86 numbers). */
export const BODY_CALM =
  "M60.2383 30.0832C73.7135 9.32787 102.559 -2.62046 133.642 1.98167C163.968 6.47198 187.69 25.4253 195.219 48.4221C196.139 48.3729 197.066 48.345 198 48.345C222.853 48.345 243 66.0298 243 87.8449C243 106.111 228.875 121.478 209.689 125.996C209.894 128.082 210 130.2 210 132.345C210 164.93 185.823 191.345 156 191.345C139.141 191.345 124.088 182.904 114.186 169.679C105.981 175.175 96.3294 178.345 86 178.345C56.1766 178.345 32 151.93 32 119.345C32 114.588 32.5155 109.963 33.4883 105.532C15.2375 100.496 2 85.5277 2 67.8449C2.00017 46.0298 22.1473 28.345 47 28.345C51.6074 28.345 56.0527 28.954 60.2383 30.0832Z";
export const BODY_ANGRY =
  "M50.8066 47.6162C56.1942 15.9638 92.0436 -4.85903 131.496 0.982407C161.963 5.4935 185.763 24.6011 193.176 47.7412C195.401 47.444 197.68 47.29 200 47.29C224.853 47.29 245 64.9748 245 86.79C245 103.566 233.085 117.896 216.278 123.623C216.753 126.768 217 129.998 217 133.29C217 165.875 192.823 192.29 163 192.29C147.407 192.29 133.357 185.068 123.5 173.52C113.643 185.068 99.5934 192.29 84 192.29C54.1766 192.29 30 165.875 30 133.29C30 130.21 30.2156 127.186 30.6318 124.233C12.8247 118.971 0 104.195 0 86.79C1.17435e-05 64.9748 20.1472 47.29 45 47.29C46.9676 47.29 48.9057 47.4012 50.8066 47.6162Z";

/** Mouth: calm smile → angry flat line. Both MC, 8 numbers. */
export const MOUTH_CALM = "M110 104.368C114.652 110.543 121.116 113.06 127.232 104.43";
export const MOUTH_ANGRY = "M106 108.43C112.5 108.43 133.5 108.43 138 108.429";

/**
 * The sparkle NEVER morphs shape — only its fill interpolates (§10). The angry
 * asset carries its own sparkle path; it is deliberately unused.
 */
export const SPARKLE_D =
  "M116.859 33.5423C119.191 29.6674 124.809 29.6674 127.141 33.5423L138.464 52.3574C139.302 53.7495 140.668 54.7423 142.251 55.1089L163.644 60.0636C168.05 61.084 169.786 66.4268 166.821 69.842L152.426 86.4251C151.361 87.652 150.839 89.2584 150.98 90.8771L152.878 112.754C153.269 117.26 148.725 120.562 144.56 118.798L124.341 110.232C122.845 109.598 121.155 109.598 119.659 110.232L99.4397 118.798C95.2755 120.562 90.7306 117.26 91.1216 112.754L93.0203 90.8771C93.1607 89.2584 92.6388 87.652 91.5737 86.4251L77.1786 69.842C74.2139 66.4268 75.9499 61.084 80.3558 60.0636L101.749 55.1089C103.332 54.7423 104.698 53.7495 105.536 52.3574L116.859 33.5423Z";

/**
 * The angry eyes, each two cubic segments. The calm eye is generated per-frame
 * from its anchor below (one segment) and subdivided to two, so it matches this
 * structure at any gaze direction.
 */
export const EYE_LEFT_ANGRY = "M96 62.5C98 64 106.966 71 106.966 74C106.966 76.5 98 85.5 96 87.5";
export const EYE_RIGHT_ANGRY = "M153.5 63C149 66.5 141 72 141 75C141 78 149.5 85 153.5 88.5";

/**
 * A calm eye, as the asset actually draws it: a vertical cubic from (x, y0) to
 * (x, y1) whose two controls sit at cy1 and cy2.
 *
 * The control heights come from the source art and are NOT evenly spaced — the
 * right eye's lower control sits at 82 where the left's sits at 74. Placing them
 * at even thirds instead (the obvious-looking simplification) flattens that
 * asymmetry and starts the angry morph from geometry the artist never drew.
 */
export interface EyeAnchor {
  x: number;
  y0: number;
  cy1: number;
  cy2: number;
  y1: number;
}

export const LEFT_EYE_ANCHOR: EyeAnchor = { x: 96, y0: 58, cy1: 63.5, cy2: 74, y1: 85 };
export const RIGHT_EYE_ANCHOR: EyeAnchor = { x: 139, y0: 59, cy1: 64.5, cy2: 82, y1: 85.5 };

/** Fill colors, interpolated in step with anger. The body ends pink-red, not red. */
export const BODY_FILL = { calm: "#7950F4", angry: "#F45084" };
export const SPARKLE_FILL = { calm: "#C06CF7", angry: "#870204" };
export const BODY_FILL_OPACITY = 0.57;
export const SPARKLE_FILL_OPACITY = 0.55;

export const EYE_STROKE_WIDTH = 12;
export const MOUTH_STROKE_WIDTH = 9;

/**
 * Fixed, generously-sized filter regions in user space (§10's implementation
 * gotcha). NOT percentage-based: a straight vertical eye has a zero-width
 * bounding box, which made an objectBoundingBox region first invalid and then —
 * after an epsilon workaround — so small it clipped the stroke away.
 */
export const FILTER_REGIONS = {
  eyeLeft: { x: 75, y: 45, width: 45, height: 55 },
  eyeRight: { x: 120, y: 45, width: 45, height: 55 },
  mouth: { x: 90, y: 85, width: 60, height: 45 },
};

/** Sparkle-Glow: heavy blur behind the body, for glassmorphism rather than a star. */
export const SPARKLE_BLUR_STD_DEVIATION = 9;
