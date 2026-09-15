import { useEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import {
  BODY_ANGRY,
  BODY_CALM,
  BODY_FILL,
  BODY_FILL_OPACITY,
  EYE_LEFT_ANGRY,
  EYE_RIGHT_ANGRY,
  EYE_STROKE_WIDTH,
  FILTER_REGIONS,
  LEFT_EYE_ANCHOR,
  MOUTH_ANGRY,
  MOUTH_CALM,
  MOUTH_STROKE_WIDTH,
  RIGHT_EYE_ANCHOR,
  SPARKLE_BLUR_STD_DEVIATION,
  SPARKLE_D,
  SPARKLE_FILL,
  SPARKLE_FILL_OPACITY,
  VIEW_BOX,
} from './assets';
import { bowEyePath, blinkTransform } from './eye';
import {
  BLINK_DURATION_MS,
  GAZE_BOW,
  GAZE_OFFSETS,
  GAZE_SUPPRESSED_RECHECK_MS,
  nextBlinkDelayMs,
  nextGaze,
  nextGazeHoldMs,
} from './gaze';
import {
  BREATHE_KEYFRAMES,
  FLOAT_KEYFRAMES,
  IDLE_DURATION_MS,
  IDLE_EASING,
  JUMP_DURATION_MS,
  JUMP_EASING,
  JUMP_KEYFRAMES,
  keyframesCss,
} from './idle';
import { makeMorpher, lerpFill } from './morph';
import { requestJump } from './jumpStorage';

/**
 * Bixy (Part 06 §10) — one character that genuinely transforms.
 *
 * Ported from the browser-verified reference implementation
 * (`docs/reference/bixy-animation-preview-v2.html`), which §10 names as
 * canonical for exact values. Plain DOM + CSS keyframes, the same technique
 * `DoodleSvg` already uses for the lesson board, rather than a second animation
 * stack for the same category of problem — and web-only for the same reason it
 * is, inheriting that accepted debt rather than adding a new one.
 *
 * Nothing here is ever stacked or crossfaded: there is one set of paths, and
 * every effect moves their points.
 */

const FLOAT_ANIMATION = 'bixy-float';
const BREATHE_ANIMATION = 'bixy-breathe';
const JUMP_ANIMATION = 'bixy-jump';

/**
 * Float and Breathe share one duration and start together, so the breath stays
 * locked to the bob instead of drifting out of phase over minutes. The jump
 * rides on top of the float by animating a nested group, so the two never fight
 * for the same transform.
 */
const STYLES = `
${keyframesCss(FLOAT_ANIMATION, FLOAT_KEYFRAMES)}
${keyframesCss(BREATHE_ANIMATION, BREATHE_KEYFRAMES)}
${keyframesCss(JUMP_ANIMATION, JUMP_KEYFRAMES)}
.bixy-float {
  animation: ${FLOAT_ANIMATION} ${IDLE_DURATION_MS}ms ${IDLE_EASING} infinite;
  transform-box: fill-box;
  transform-origin: 50% 50%;
}
.bixy-breathe {
  animation: ${BREATHE_ANIMATION} ${IDLE_DURATION_MS}ms ${IDLE_EASING} infinite;
  transform-box: fill-box;
  transform-origin: 50% 50%;
}
.bixy-jump {
  animation: ${JUMP_ANIMATION} ${JUMP_DURATION_MS}ms ${JUMP_EASING} 1;
  transform-box: fill-box;
  transform-origin: 50% 50%;
}
.bixy-face { transition: transform 0.35s cubic-bezier(.3,.6,.3,1); }
.bixy-eye { transition: transform 0.09s ease-in; }
@media (prefers-reduced-motion: reduce) {
  .bixy-float, .bixy-breathe, .bixy-jump { animation: none; }
  .bixy-face, .bixy-eye { transition: none; }
}
`;

/** The drop-shadow stack the assets put on each facial feature. */
function FeatureGlow({ id, region }: { id: string; region: { x: number; y: number; width: number; height: number } }) {
  return (
    // Fixed, generously-sized region in USER SPACE, never percentage-based: a
    // straight vertical eye has a zero-width bounding box, which made an
    // objectBoundingBox region first invalid and then — with an epsilon
    // workaround — small enough to clip the stroke away (§10's gotcha).
    <filter
      id={id}
      x={region.x}
      y={region.y}
      width={region.width}
      height={region.height}
      filterUnits="userSpaceOnUse"
      colorInterpolationFilters="sRGB"
    >
      <feFlood floodOpacity="0" result="bg" />
      <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
      <feOffset />
      <feGaussianBlur stdDeviation="3.5" />
      <feComposite in2="hardAlpha" operator="out" />
      <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.5 0" />
      <feBlend mode="normal" in2="bg" result="e1" />
      <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
      <feOffset />
      <feGaussianBlur stdDeviation="2.9" />
      <feComposite in2="hardAlpha" operator="out" />
      <feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.63 0" />
      <feBlend mode="normal" in2="e1" result="e2" />
      <feBlend mode="normal" in="SourceGraphic" in2="e2" result="shape" />
    </filter>
  );
}

export interface BixyCharacterProps {
  /** Rendered height in px; width follows the character's aspect ratio. */
  height?: number;
  /** 0–1 (Part 05 §8's streak, decayed). Drives shape AND color together. */
  anger?: number;
  /**
   * True while Bixy is addressing the student — greeting, narrating, mid
   * check-in. Look-Around pauses and gaze holds front; Blink keeps running.
   * Anger implies this too: an angry Bixy is addressing them continuously.
   */
  addressing?: boolean;
  /** Play the opening Jump if the once-per-hour throttle allows it. */
  jumpOnMount?: boolean;
}

export function BixyCharacter({
  height = 180,
  anger = 0,
  addressing = false,
  jumpOnMount = false,
}: BixyCharacterProps) {
  const jumpRef = useRef<SVGGElement | null>(null);
  const bodyRef = useRef<SVGPathElement | null>(null);
  const sparkleRef = useRef<SVGPathElement | null>(null);
  const mouthRef = useRef<SVGPathElement | null>(null);
  const eyeLeftRef = useRef<SVGPathElement | null>(null);
  const eyeRightRef = useRef<SVGPathElement | null>(null);
  const faceRef = useRef<SVGGElement | null>(null);

  // Built once: parsing and structure-checking the body path on every frame
  // would be wasteful, and a mismatch is a load-time problem, not a per-frame one.
  const morphBody = useMemo(() => makeMorpher(BODY_CALM, BODY_ANGRY, 'body-path'), []);
  const morphMouth = useMemo(() => makeMorpher(MOUTH_CALM, MOUTH_ANGRY, 'mouth-path'), []);

  // The eye `d` depends on gaze AND anger at once, so both live in refs and one
  // function rebuilds from whatever the current pair is — the same arrangement
  // the reference uses, and the reason the two effects compose instead of
  // overwriting each other.
  const bowRef = useRef(0);
  const angerRef = useRef(anger);

  const updateEyes = useRef(() => {});
  updateEyes.current = () => {
    const t = angerRef.current;
    const left = makeMorpher(bowEyePath(LEFT_EYE_ANCHOR, bowRef.current), EYE_LEFT_ANGRY, 'eye-left');
    const right = makeMorpher(bowEyePath(RIGHT_EYE_ANCHOR, bowRef.current), EYE_RIGHT_ANGRY, 'eye-right');
    eyeLeftRef.current?.setAttribute('d', left(t));
    eyeRightRef.current?.setAttribute('d', right(t));
  };

  // Anger: shape and color move together, in one pass.
  useEffect(() => {
    const t = Math.max(0, Math.min(1, anger));
    angerRef.current = t;
    bodyRef.current?.setAttribute('d', morphBody(t));
    mouthRef.current?.setAttribute('d', morphMouth(t));
    bodyRef.current?.setAttribute('fill', lerpFill(BODY_FILL.calm, BODY_FILL.angry, t));
    sparkleRef.current?.setAttribute('fill', lerpFill(SPARKLE_FILL.calm, SPARKLE_FILL.angry, t));
    updateEyes.current();
  }, [anger, morphBody, morphMouth]);

  // Look-Around. `front` is more than half the pool and is itself the resting
  // state, so there's no pause between glances — the next target is drawn as
  // soon as the hold elapses.
  const suppressed = addressing || anger > 0;
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let stopped = false;

    const loop = () => {
      if (stopped) return;
      if (suppressed) {
        apply('front');
        timer = setTimeout(loop, GAZE_SUPPRESSED_RECHECK_MS);
        return;
      }
      const target = nextGaze(Math.random, false);
      apply(target);
      timer = setTimeout(loop, nextGazeHoldMs(Math.random));
    };

    const apply = (target: keyof typeof GAZE_OFFSETS) => {
      const offset = GAZE_OFFSETS[target];
      // Eyes, mouth and sparkle move as ONE group — eyes moving in isolation
      // reads as them sliding inside a static face.
      faceRef.current?.setAttribute('transform', `translate(${offset.x} ${offset.y})`);
      bowRef.current = GAZE_BOW[target];
      updateEyes.current();
    };

    loop();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [suppressed]);

  // Blink — an independent loop, free to overlap a glance, which is what a face
  // actually does.
  useEffect(() => {
    let openTimer: ReturnType<typeof setTimeout>;
    let nextTimer: ReturnType<typeof setTimeout>;
    let stopped = false;

    const setClosed = (closed: boolean) => {
      eyeLeftRef.current?.setAttribute('transform', blinkTransform(LEFT_EYE_ANCHOR, closed));
      eyeRightRef.current?.setAttribute('transform', blinkTransform(RIGHT_EYE_ANCHOR, closed));
    };

    const loop = () => {
      if (stopped) return;
      setClosed(true);
      openTimer = setTimeout(() => {
        setClosed(false);
        nextTimer = setTimeout(loop, nextBlinkDelayMs(Math.random));
      }, BLINK_DURATION_MS);
    };

    nextTimer = setTimeout(loop, nextBlinkDelayMs(Math.random));
    return () => {
      stopped = true;
      clearTimeout(openTimer);
      clearTimeout(nextTimer);
    };
  }, []);

  // The opening Jump, at most once an hour across reloads.
  useEffect(() => {
    if (!jumpOnMount) return;
    const node = jumpRef.current;
    if (!node || !requestJump(Date.now())) return;
    node.classList.add('bixy-jump');
    const timer = setTimeout(() => node.classList.remove('bixy-jump'), JUMP_DURATION_MS + 50);
    return () => clearTimeout(timer);
  }, [jumpOnMount]);

  if (Platform.OS !== 'web') return null;

  const [, , vbWidth, vbHeight] = VIEW_BOX.split(' ').map(Number);
  const width = Math.round(height * (vbWidth! / vbHeight!));

  return (
    <div style={{ display: 'inline-block', lineHeight: 0 }}>
      <style>{STYLES}</style>
      <svg
        viewBox={VIEW_BOX}
        width={width}
        height={height}
        style={{ overflow: 'visible' }}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          {/* Percentage-based is fine HERE: the sparkle's bounding box is never
              degenerate, and the region needs to be large for a heavy blur. */}
          <filter id="bixy-sparkle-blur" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation={SPARKLE_BLUR_STD_DEVIATION} />
          </filter>
          <FeatureGlow id="bixy-eye-left-glow" region={FILTER_REGIONS.eyeLeft} />
          <FeatureGlow id="bixy-eye-right-glow" region={FILTER_REGIONS.eyeRight} />
          <FeatureGlow id="bixy-mouth-glow" region={FILTER_REGIONS.mouth} />
        </defs>

        <g className="bixy-float">
          <g ref={jumpRef}>
            {/* Behind the body, blurred — glassmorphism, not a crisp star. */}
            <path
              ref={sparkleRef}
              d={SPARKLE_D}
              filter="url(#bixy-sparkle-blur)"
              fill={SPARKLE_FILL.calm}
              fillOpacity={SPARKLE_FILL_OPACITY}
            />
            <path
              ref={bodyRef}
              className="bixy-breathe"
              d={BODY_CALM}
              fill={BODY_FILL.calm}
              fillOpacity={BODY_FILL_OPACITY}
            />
            <g ref={faceRef} className="bixy-face">
              <g filter="url(#bixy-eye-left-glow)">
                <path
                  ref={eyeLeftRef}
                  className="bixy-eye"
                  d={bowEyePath(LEFT_EYE_ANCHOR, 0)}
                  stroke="white"
                  strokeWidth={EYE_STROKE_WIDTH}
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              <g filter="url(#bixy-eye-right-glow)">
                <path
                  ref={eyeRightRef}
                  className="bixy-eye"
                  d={bowEyePath(RIGHT_EYE_ANCHOR, 0)}
                  stroke="white"
                  strokeWidth={EYE_STROKE_WIDTH}
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              <g filter="url(#bixy-mouth-glow)">
                <path
                  ref={mouthRef}
                  d={MOUTH_CALM}
                  stroke="white"
                  strokeWidth={MOUTH_STROKE_WIDTH}
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
