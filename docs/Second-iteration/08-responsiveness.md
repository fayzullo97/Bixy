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
