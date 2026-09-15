# Bixy PRD — Part 3: Board & Doodles

> Covers original PRD §4, §14. Read `00-context-shipped-v1.md` first.
> Referenced by Part 06 (Bixy character animation reuses this same
> react-native-svg + Reanimated approach) and Part 08 (grid growth ties into
> the board's content-height growth here). §14 is currently blocked — see
> below.

---

### 4. Doodle board stacking and reset

**What changed (v14.3, verified against codebase v14.21):** Fixes doodles from different story beats rendering
on top of each other (e.g. a two-part story where part 2's doodles overlapped
part 1's instead of appearing below them).

- **Implementation mechanism corrected:** originally speced as an explicit
  running cursor — measure each beat's rendered bounding box, take max Y,
  add 50px, use that as the next beat's origin. What actually shipped
  (already in the working tree) reaches the same outcome through flex
  layout instead (`flexDirection: 'row'`, `alignItems: 'flex-end'`, a
  `marginBottom: 50` spacer) rather than manual measurement — React Native
  already does that layout math natively, and a measure→setState→re-render
  cycle would add a frame of jitter right before each draw-in that the flex
  approach avoids entirely. The **outcome** is the requirement (never
  overlaps, stacks downward, 50px gap) — this is a better implementation of
  it, not a deviation from it.
- Confirmed already satisfied: previously-drawn beats are never erased or
  moved (strictly append-only), starting a new topic fully resets the board
  (remounts to blank canvas on topic change), and the board auto-scrolls on
  new content.
- Confirmed matches the evolving-scene decision (not per-beat panels):
  consecutive story beats merge into one persistent scene where, e.g., a
  character gains a face and then a speech bubble in place, rather than
  each beat getting its own disconnected panel — matches the earlier
  decision to preserve v1's "dialogue advances in place" continuity.
- **Correction:** an earlier version of this doc said the hand-drawn
  draw-in animation "fell back to a plain fade-in in the live app." That
  doesn't match the code — there is no fade-in path; the current
  implementation already does real per-path stroke-dashoffset drawing (90ms
  stagger, 420ms draw). Whatever prompted the original bug report either
  predates this code or was inaccurate at the time; either way, there's
  nothing to fix here for the current 20-asset library — see §14 below for
  why this only matters again once more complex artwork exists.
- **New bug found via code trace, not previously known:** objects attached
  to a person (e.g. multiple props on one character) all render at the same
  fixed offset, so two objects on one person land exactly on top of each
  other. Separate from the beat-to-beat overlap this section originally
  addressed. Confirmed as in-scope to fix now, alongside committing the
  Scene.tsx flex layout — both are §4 territory and don't depend on new
  artwork.

### 14. Complex-SVG doodle reveal animation

**Status: blocked, not building yet.** The premise this section was built
against — a doodle library of complex, richly-illustrated, mostly-filled
SVGs with hundreds of raw paths and no group structure — doesn't match the
actual library. All 20 current assets are simple, stroke-based (2–18 paths,
exactly one group each), and the existing stroke-dashoffset technique
genuinely suits them (§4's "why the old technique doesn't scale" reasoning
is correct in general, just doesn't apply to this artwork yet). Applying a
15-batch reveal to an 18-path asset would be a visual downgrade, not an
improvement — confirmed via direct math: 90ms-stagger stroke-draw is ~2s on
today's largest asset; this section's technique only becomes necessary at
the complexity that motivated it (959 paths × 90ms stagger ≈ 86s under the
current technique).

**Explicitly deferred until real illustration-style artwork exists** —
not being built speculatively with a complexity-gated threshold in the
meantime, since there's no real data yet on what the actual future library
looks like to calibrate a threshold against. When the new art lands: build
this section for real, and re-verify the timing numbers below against a
few real assets of varying complexity, not just the single demo asset they
were originally tuned against.

**What changed (v14.14, timing confirmed v14.15):** Replaces the
stroke-dashoffset draw-in animation (§4 above) with a piece-by-piece group
reveal, to support a shift from simple stroke-based doodles to much more
complex, richly-illustrated SVG artwork in the reusable doodle library.

- **Why the old technique doesn't scale:** `strokeDasharray`/
  `strokeDashoffset` only animates a path's stroke (an outline being
  traced) — it has no effect on filled shapes. Complex illustration-style
  artwork is mostly filled, multi-layered groups, not simple open outlines,
  so that technique structurally can't extend to richer art no matter how
  it's tuned.
- **New technique:** each named layer/group within a doodle's SVG reveals
  in sequence — a quick scale-up (~85%→100%) plus fade-in per piece, rather
  than a plain opacity fade, so each piece still feels "placed" rather than
  a slideshow dissolve. No hand-cursor overlay — Bixy has no hands/limbs to
  sell that illusion with (it's a limbless blob character, see Part 06), so
  the piece-by-piece sequencing alone carries the "being drawn" feel.
- **Reveal order:** follows the SVG's authored document/layer order — the
  same z-order the designer already sets for correct visual layering
  (background before foreground, etc.) doubles as the reveal sequence, with
  no separate reveal-order metadata needed per illustration.
- **Batching:** most real illustration assets aren't organized into named
  groups at all — one tested asset came in as 959 individual raw paths with
  zero groups (mostly fine hatching/texture layered over a base shape).
  Revealing that many pieces one at a time would take far too long, so
  pieces are split into a **fixed 15 batches** regardless of the asset's
  actual path count — each batch reveals together as one step. Batch size
  scales automatically with complexity (a simple few-path doodle ends up
  with ~1 piece per batch; a 959-path illustration ends up with ~64 per
  batch), which keeps total reveal time roughly constant across assets of
  wildly different complexity rather than scaling up with piece count.
- **Timing (confirmed via live preview against a real 959-path asset):**
  15 batches, 50ms between batches, 150ms fade per piece — total sequence
  ≈0.85s. Replaces the earlier placeholder ranges.
- **Library approach unchanged:** stays a reusable library the AI selects
  and arranges from (v1 shipped architecture) — only the artwork itself
  gets replaced with more complex illustrations, and the library keeps
  growing as more images are added over time.
- **Board-placement mechanics unaffected:** the flex-based stacking layout,
  50px spacing, and evolving-scene grouping (§4 above) all stay as-is —
  only the draw-in animation technique changes, not how doodles are
  positioned.
