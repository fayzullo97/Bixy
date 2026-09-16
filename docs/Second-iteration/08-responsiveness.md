# Bixy PRD — Part 8: Responsiveness

> Covers original PRD §15. Read `00-context-shipped-v1.md` first. The grid
> growth here ties into the board-cursor system from Part 03 §4.

---

### 15. Responsiveness — Telegram Desktop fullscreen + endless grid

**What changed (v14.20):**

**Telegram Desktop fullscreen:** app opens fullscreen by default on launch,
student can exit manually.
- `WebApp.requestFullscreen()` on launch, gated behind
  `WebApp.isVersionAtLeast('8.0')` (fullscreen added in Bot API 8.0,
  confirmed supported on desktop specifically, not just mobile) — older
  clients that don't support it fall back to `WebApp.expand()` instead
- Listens for `fullscreenChanged` / `fullscreenFailed` rather than assuming
  the request succeeded
- Respects `safeAreaInset` / `contentSafeAreaInset` once fullscreen, so
  content doesn't collide with OS window chrome
- Exit is manual — a control calling `WebApp.exitFullscreen()`, matching
  "student can minimize it later"

**Endless viewport-glow grid:** the Whiteboard's background grid (light
grey stroke) extends across the full scrollable content height rather than
being a fixed-size image — a repeating tile pattern, extended whenever the
board's content grows (ties into Part 03 §4's board-cursor growth).

The visible-on-screen portion of the grid gets a radial purple gradient
tint on its strokes, **centered on the screen** (a fixed spotlight,
always centered on the viewport, not tied to content position or Bixy).
Implementation avoids scroll-position tracking entirely: a second copy of
the same repeating grid pattern, tinted with the radial gradient, is
pinned to the viewport (never scrolls) and layered on top of the scrolling
grey grid underneath. Since both are the same uniform repeat, they always
line up regardless of scroll offset, so it reads as "whatever's on screen
glows purple" for free.

---

## Confirmed implementation notes (build pass)

Recorded during the Part 08 build, in the same form as Part 07's.

1. **One grid, rendered twice at identical coordinates.** Both layers are
   absolutely positioned fills of the same scroll content box, painting the same
   repeating tile from the same origin, and both scroll with the content. They
   are never independently positioned, so there is no scroll offset at which
   they can double or drift — whatever movement the grey lines get, the purple
   lines get too, pixel for pixel. `layersCoincide()` asserts the shared
   geometry in the test suite, since two builder functions is exactly how the
   layers would quietly diverge later.
2. **The mask centre is tracked by a scroll listener, not pinned by CSS.**
   `mask-attachment: fixed` (and any `position: fixed` equivalent) is
   deliberately avoided: WebView support is inconsistent, and Telegram's in-app
   browser is not the engine to gamble on it with. On each scroll tick the
   handler recomputes `scrollTop + clientHeight / 2` and rewrites the purple
   layer's `mask-image` and `-webkit-mask-image`, which holds the glow on the
   middle of the screen while the grid scrolls underneath.
   Updates are coalesced to one per animation frame (a scroll event can fire
   more often than the compositor paints), the listener is passive, and the
   mask string is rounded to whole pixels so a frame with no real change
   produces no churn. A `ResizeObserver` covers the case a scroll event can't:
   the board growing a new beat changes the scroller's height without any
   scroll or resize event firing.

   *Supersedes an earlier attempt* that pinned a second `position: fixed` copy
   of the grid to the viewport and anchored both layers with
   `background-attachment: fixed`. That relied on a CSS feature with poor
   WebView support, and — because a pinned overlay and a content-anchored
   underlay do not share an origin — would have doubled the grid at most scroll
   positions unless both were anchored, which in turn stopped the grid from
   scrolling at all. Replaced entirely; nothing pins any more.
3. **The board's content box now has `flexGrow: 1`.** Without it, a lesson
   shorter than the viewport leaves the grid stopping where the content does,
   with a bare edge below — the same "runs out" failure §15 exists to remove.
   This is the existing flex mechanism from Part 03 §4 doing the work, not a new
   one: the grid is painted on the content box, and the content box is what flex
   already sizes.
4. **No growth mechanism was added.** Part 03 §4's board cursor is flex layout
   (`alignSelf: 'stretch'` plus a `marginBottom: 50` spacer), not a measured
   cursor. The grid is painted on the scroll content container, so its extent is
   that same box — it grows in lockstep by construction, with nothing to keep in
   sync and no second cursor.
5. **`expand()` moved out of the auth path.** It used to be called
   unconditionally in `getTelegramInitData` on every client. §15 makes launch
   sizing a fullscreen request with `expand()` as its pre-8.0 fallback, so
   leaving the old call would have fired `expand()` on the 8.0+ clients that are
   about to go fullscreen. Sizing now lives entirely in `useTelegramFullscreen`.
6. **The fullscreen request waits for the SDK.** The Telegram `<script>` is
   injected at runtime, so a hook that reads `window.Telegram?.WebApp`
   synchronously on mount finds nothing and silently never requests anything.
   `ensureTelegramWebApp()` is now exported from the auth bridge and awaited by
   both consumers.
7. **Added beyond the spec: a 1.5s watchdog on the fullscreen request.** §15
   specifies the two events and no timeout. But those events are the only signal,
   and a client that fires neither would leave the app at its default
   un-expanded size — strictly worse than v1, which always called `expand()`.
   The watchdog calls `expand()` if neither event arrives, and is cancelled the
   moment either does. Recorded as an addition, not an inference.
8. **`ALREADY_FULLSCREEN` is not treated as a failure.** Telegram documents it
   as a `fullscreenFailed` error, but it means the app is already in the state it
   asked for. Falling back to `expand()` on it, or hiding the exit control,
   would both be wrong.
9. **Safe-area insets are summed, not maxed.** `safeAreaInset` (device/window
   chrome) and `contentSafeAreaInset` (Telegram's own UI inside that) are nested
   regions, so taking the larger of the two would slide content under whichever
   is smaller. Insets are applied only while fullscreen — outside it Telegram
   already lays the Mini App out inside its chrome, and adding them would double
   the gap.

### Needs a real Telegram Desktop client to confirm

None of the following can be observed from typecheck, unit tests, or the
production bundle — they are listed so they get checked on a real client rather
than assumed:

- that `requestFullscreen()` is actually honoured on Telegram **Desktop**
  (§15 asserts it is; only the call and its gate are verified here);
- the real values of `safeAreaInset` / `contentSafeAreaInset` on desktop, and
  whether summing them produces sensible padding rather than an over-large gap;
- that `fullscreenChanged` / `fullscreenFailed` fire with the shapes assumed,
  and whether the 1.5s watchdog ever trips on a healthy client;
- that the exit control is positioned clear of the window chrome once real
  insets are applied;
- the grid's appearance in situ — tile pitch, stroke weights, and glow radius
  are unverified by eye;
- whether the scroll-tracked glow keeps up with a fast flick on a real client
  (see the platform risk below).

### Known platform risk

The glow's position is updated from a scroll handler, so on a device that
throttles or coalesces scroll events aggressively the purple centre can lag
behind a fast flick and catch up when the scroll settles. Updates are already
coalesced to one per animation frame and do nothing but rewrite one string, so
there is no per-frame work left to trim; if it proves visible on a real client
the fix is a different mechanism, not further tuning. **This is a real platform
constraint to check by eye on a device, not something to work around silently.**

The grey grid itself cannot lag: it is a painted background on the scrolling
content, so it moves with the compositor. Only the mask's centre is script-driven.
