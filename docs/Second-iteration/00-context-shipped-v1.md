# Bixy PRD — Part 0: Shared Context (Shipped v1)

> Split from the master PRD at v14.20. This part isn't a build task — every
> other part (01 through 08) assumes this context and should be read first,
> since Iteration 2 work modifies or extends this existing system rather than
> starting from scratch. This is a fixed historical record; don't edit it
> while building — if something here turns out to be inaccurate, flag it
> rather than silently changing it.

---

## Shipped in v1 (production, live)

**Product**: Self-study English grammar tutor. Student picks a topic (typed or via
photo of a textbook/blackboard), Bixy (the AI tutor persona) explains it on a
virtual whiteboard using a two-track story/formal delivery model, with doodles,
narrated voice, check-in questions, and an end-of-topic quiz.

**Architecture**
- Modular monolith: single Node.js/Express backend, clean internal module boundaries
- Client: React Native + Expo, used for the web app now (not just future mobile),
  for code-sharing once native apps get built
- Combined deployment: Expo web build + Express API served from **one Vercel
  project** (`bixy-chi.vercel.app`) — `vercel.json` builds the frontend via
  `@vercel/static-build` and the API via `@vercel/node`, with routes splitting
  API prefixes from the SPA catch-all
- Data: Supabase (Postgres + storage bucket for narration audio)
- Content grounding: `reference-material.json` — 366 topics across 6 CEFR tiers
  (A1/A2/B1/B1+/B2/C1), each a lean outline (formula, key idea, examples, common
  mistake), reviewed for copyright cleanliness; AI generates the full lesson live
  from this outline, not from prose

**Auth**
- Telegram Mini App (not Login Widget): app opens from inside Telegram via the
  bot's Menu Button/`t.me` link, reads identity from `window.Telegram.WebApp`
  `initData` — zero login screen, no phone-number prompt
- Backend verifies `initData`'s HMAC-SHA256 signature (secret = HMAC(bot token,
  key="WebAppData")) with a 24h freshness window; rejects missing/invalid/expired
- Direct browser visits (outside Telegram) get a fallback "Open this app in
  Telegram" screen instead of a broken login flow

**TTS / narration**
- Narration audio generated server-side per lesson (Aisha API integration),
  cached and served from the Supabase `narration` bucket

**Persona**
- Tutor named **Bixy** — gender-ambiguous, invented character; register/tone
  adapts to context (casual in light moments, measured while explaining, more
  patient only after a repeated struggle pattern, not one hard topic); stays
  in-character if asked whether it's real
- Greeting: the day-boundary full/short greeting (full greeting once per
  day, short "welcome back" on later same-day visits) **did ship and is
  live** — confirmed via code trace (`greeting.ts`, `last_greeted_at` from
  migration 0005, `POST /me/greeting`, wired into `PathBoardScreen`). This
  corrects an earlier version of this doc that claimed the whole mechanism
  never shipped — that was too broad. The piece that was actually missing
  was narrower: the one-time first-meeting sequence (introduction +
  get-to-know-you conversation), built in Part 05.

**Core learning flow**
- Sign-in → level check (15 fill-in-the-blank questions, tiered, early-stop
  logic) → fixed ordered study plan computed once from placement → dashboard
  (progress + one button to the board) → lesson (discovery → recap → confirm
  rule → practice/test) → must pass topic quiz to advance
- Typed/photo topic requests work mid-plan as an out-of-path detour, tracked
  per student so it isn't re-taught later
- Variant-pooling: designed as repeat/failed-check content pulling an
  existing stored variant before generating a new one, but **never actually
  built** — `pickReTeachVariant` is a one-line pass-through stub, confirmed
  via code trace. Being built for real as part of Part 04, which depends on
  it.

**Scope boundaries (deliberate, not gaps)**
- Grammar only for v1 — speaking/listening/reading/writing are a planned later
  expansion of the same product, not a separate product
- No monetization model yet — deferred until after that expansion
- Native iOS/Android app is a separate later initiative — the whiteboard
  animation rework for native is deferred to that phase
- No content past C1 tier yet — flagged, not resolved

---

## Known issues surfaced during Iteration 2 build (no clear part owner)

- **Duplicate mid-arc title beat:** an A1 lesson's generated arc contained a
  second title beat midway through (…check_in_question → title → story →
  explanation…), which would render two titles on one board. This is a
  lesson-structure/arc-shape concern, not language, TTS, or board rendering,
  so it doesn't fit Parts 01–08 as currently scoped. Unknown whether it
  predates Iteration 2 work or was introduced by it. Not yet investigated.

---

## Known follow-ups from v1 (carry into iteration 2 backlog)

- [ ] Bot token used for `initData` HMAC was chat-exposed at one point —
      confirm rotation actually completed and is the one live in Production
- [ ] `vercel.json` / `app/package.json` (vercel-build script) — confirm these
      landed on `main`, not still sitting on a feature branch
- [ ] Any temporary diagnostic logging added while debugging `invalid_init_data`
      (raw `initData` capture, `getMe` check) should be confirmed removed —
      `initData` contains real user info and shouldn't sit in prod logs
- [ ] Telegram token validation is at standard code review, not a dedicated
      security audit (accepted for MVP, revisit before scaling)

---

## Map of the other parts

- **01 — Language & TTS**: level-gated language split, TTS provider architecture
- **02 — Narration pipeline**: pacing/filler words/subtitles, formal-track narration coverage
- **03 — Board & doodles**: board stacking/reset, complex-SVG reveal animation
- **04 — Quiz & flow control**: topic-fail retry flow, detour resume fix
- **05 — Persona & greeting**: greeting mechanism, tone-shift + identity-deflection fixes
- **06 — Bixy character animation**: full animation spec (Blink, Look-Around, Float, Breathe, Sparkle-Glow, Jump, Angry-Morph)
- **07 — Home screen & navigation**: home screen redesign, Figma file reference, end-to-end screen flow
- **08 — Responsiveness**: Telegram Desktop fullscreen, endless viewport-glow grid
