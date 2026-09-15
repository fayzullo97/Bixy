# Bixy PRD — Part 6: Bixy Character Animation

> Covers original PRD §10. Read `00-context-shipped-v1.md` first. Reuses the
> react-native-svg + Reanimated approach from Part 03 (board & doodles), and
> the Angry-Morph trigger reuses the tone-shift signal from Part 05 §8.
> Referenced by Part 07 (used in the home-screen hero scene).

---

### 10. Bixy character animation

**What changed (v14.9):** Full animation spec for the Bixy mascot character
— constant idle behaviors plus situational reactions. Two labeled SVG source
assets exist (calm and angry states), each with named parts (`sparkle`,
`body-path`, `eye-left-path`, `eye-right-path`, `mouth-path`) so parts can
animate independently: `bixy-character-labeled.svg` and
`bixy-character-angry-labeled.svg`.

**Asset note:** the two SVGs differ slightly in canvas size (241×191 calm
vs. 245×193 angry) — calm coordinates get shifted +2,+1 to align onto the
angry canvas before any interpolation between them, confirmed working via
live preview.

**Named animations (for quick reference — use these names instead of
re-describing):**

| Name | What it is |
|---|---|
| **Blink** | Periodic eye squash |
| **Look-Around** | Random gaze wander — eyes, mouth, and sparkle move together; eyes also curve toward the gaze direction |
| **Float** | Whole-character slow vertical bob |
| **Breathe** | Subtle body-shape squash/skew, synced to Float |
| **Sparkle-Glow** | Blurred glassmorphism accent behind the body |
| **Jump** | App-open squash → launch → settle, throttled to 1/hour |
| **Angry-Morph** | Anger-driven body/eye/mouth shape + color transform |

**Technical approach:** builds on the same react-native-svg + Reanimated
stack already used for the lesson-board doodle animations (Part 03), rather
than introducing Lottie/Rive or a new animation library. Built as a
self-contained component so it can be reused in both the home-screen hero
scene (Part 07) and the lesson board.

**Constant animations (always running, with one standing exception):**
- **Standing rule: look-around pauses whenever Bixy is actively speaking or
  narrating to the student** — during greeting, lesson narration, or any
  other moment Bixy is directly addressing the student, gaze stays front
  and only the blink loop continues. This applies everywhere, not just
  during angry mode (see below, which is one instance of this same rule,
  not a separate behavior).
- **Blink** + **Look-Around** — confirmed via live preview, with scope wider
  than originally speced:
  - **Blink**: periodic scaleY-to-near-zero on each eye path around its own
    vertical center, randomized interval
  - **Look-Around**: random target among 5 directions (top-left, left,
    top-right, right, front), small position offset held then released —
    front should come up often enough that gaze doesn't feel constantly
    darting. **Eyes, mouth, and the sparkle accent all move together** as
    one group on look-around, not just the eyes — confirmed this reads
    much more natural than eyes moving in isolation.
  - **Eyes procedurally curve toward the gaze direction, replacing the
    original fixed-curve eye art.** The source asset was updated (calm
    character eyes are now perfectly straight lines at rest) specifically
    to make this possible — the eye curve is generated from a "bow" amount
    that's exactly 0 at front (dead straight, matching the source art
    exactly) and signed by direction (negative = curves left, positive =
    curves right). This directly replaces the earlier translation-only
    approach and its accepted imperfection (rightward gaze reading weaker
    than leftward) — that limitation no longer applies, since the eye
    shape itself now genuinely changes with direction rather than just
    shifting position. The character still never mirrors/flips (that
    approach was tried and rejected, per the earlier decision) — this
    achieves the same goal a cleaner way.
  - The bow-curved eye shape is built by splitting the (straight or curved)
    eye curve into two segments via exact Bézier subdivision — same
    technique as Angry-Morph's eye handling below — so it stays
    structurally compatible for morphing into the angry eye shape
    regardless of current gaze direction; the two effects compose
    correctly together.
  - Blink and Look-Around loops run independently and can overlap
- **Float** + **Breathe**: continuous slow vertical oscillation (small
  amplitude, sine ease) on the whole character (Float); synced subtle
  non-uniform scale/skew on `body-path` approximates a "breathing curve"
  effect (Breathe, not true path morphing) — kept barely-there, not a
  visible squish
- **Sparkle-Glow:** sits behind the body, blurred (heavy Gaussian blur,
  reduced opacity) for a soft glassmorphism look rather than a crisp star
  shape — confirmed via live preview after the first pass wasn't blurred
  enough.

**Situational animations:**
- **Jump:** squash (scale down) → launch (scale up beyond normal
  height, thinner width, upward motion) → land/settle with a slight bounce.
  Throttled to once per hour via a persisted last-played timestamp, so it
  doesn't replay on every return visit within the hour.
- **Angry-Morph:** anger is a float 0–1, not a binary toggle. **Confirmed via
  live preview as genuine single-character morphing, not two images
  crossfading:**
  - Trigger: increments on consecutive full re-teaches — reuses the same
    signal/counter already built for the persona tone-shift work (Part 05
    §8), not a separate counter
  - While anger > 0: `body-path` and `mouth-path` interpolate point-by-point
    between their calm and angry shapes (both pairs share identical
    command/point structure, confirmed directly against the real assets, so
    this is a true geometric transform, not an approximation). Eye paths
    interpolate the same way — the calm eye curve was split into two
    segments via exact Bézier subdivision (same visual shape, one added
    point) specifically so its structure matches the angry eye's two-segment
    shape and both can morph point-by-point too. Body fill and the sparkle
    accent's fill both interpolate color (purple→red) in step with the same
    anger value. Nothing is ever stacked or opacity-crossfaded — one set of
    paths, transforming.
  - Look-Around stays off per the standing rule above (Bixy is effectively
    always "addressing" the student while angry), Blink keeps
    running
  - Decay: linear decay to 0 over 3 hours of real time from trigger,
    persisted so decay continues correctly across app restarts, not just
    within one session
  - Float and Breathe keep running unchanged underneath Angry-Morph — only
    Look-Around and the shape/color transform change

**Implementation gotcha found during preview (worth carrying forward to
avoid re-discovering it):** percentage-based (objectBoundingBox) filter
regions on the eye/mouth glow filters broke in two different ways once
eyes could be a near-straight line — first the region went fully invalid
at exactly-straight (zero-width bounding box, element didn't render at
all), and after working around that with a tiny non-zero epsilon, the
region scaled down with the now-tiny bounding box and clipped most of the
stroke width away instead. Fixed by giving the eye and mouth filters their
own fixed, generously-sized **absolute** regions (`userSpaceOnUse`) instead
of regions computed from the path's own bounding box — since that box can
legitimately approach zero width for this character's eye shapes, don't
rely on percentage-based filter regions for them.
