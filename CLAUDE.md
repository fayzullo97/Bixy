# Whiteboard AI Tutor — project context

This file loads automatically at the start of every Claude Code session.
Keep it short — it's a persistent reminder, not the spec. Full detail for
whatever you're building lives in docs/phase-N-*.md.

## What this is
## 1. Overview

Whiteboard AI Tutor is a web app that teaches a topic the way a human tutor would on a whiteboard — writing, drawing, and doodling out an explanation in real time, narrating as it goes — except the "tutor" is AI, generated on demand for whatever the student asks. The first release focuses on one use case: a self-study English grammar tutor for learners who want Khan Academy-quality explanations without a human teacher. The screen is a single, giant, mostly-empty board with one input control at the bottom — the student types a topic, asks about the current lesson, or asks the board to re-explain something they didn't follow.

The product's defining bet is technical: instead of generating a locked video (as most "AI whiteboard" tools do today), the app generates **structured, replayable board content** — an AI-authored sequence of draw/write/narrate actions that the client renders live. Because the board is live UI state and not a video file, any part of a lesson can be replayed, re-explained, or regenerated in isolation, which is the feature the whole product is organized around.

---

## 2. Problem statement

Self-study English learners today have two options, neither of which is what they actually want:

1. **Text-based AI tutors** (e.g. Khanmigo) explain well in words, but present nothing visually — no diagrams, no timeline of a tense, no drawn comparison of "past simple vs. present perfect." For a visual/spatial subject like grammar, this is a real gap: even Khan Academy's own flagship AI tutor has no visual aids or diagrams in the tutor chat itself, relying instead on its library of human-recorded videos for anything visual.
2. **AI whiteboard-style video generators** (Golpo, Knowlify, Simi, Powtoon, and similar tools) solve the visual problem but produce a rendered video from a prompt or document. That's fine for a one-off explainer, but wrong for tutoring: if the student doesn't understand minute 2 of a 4-minute video, there's no way to ask for just that part again in a different way — the whole clip would need to be regenerated.

No mainstream product currently combines "explains visually, like a whiteboard tutor" with "fully interactive and re-explainable, like a chat." That combination is the opportunity, and it is unproven — nobody, including much larger players, has shipped it yet.

---


## Non-goals for v1 — do not build these
- Not a general-purpose chatbot; the interaction model is "pick or ask for a topic," not open-ended conversation.
- Not a live human-tutor marketplace or classroom/multi-student product.
- Not attempting full curriculum breadth (reading, writing, listening, speaking) — v1 is grammar explanation only, deliberately: the intended long-term product covers all of these, but grammar is the starting point, not the ceiling (§6.2).
- Not supporting arbitrary subjects at launch — architecture should allow it later, but content investment in v1 is English grammar only.
- Not building any interface beyond the single input on the board itself — no topic browser, no visible settings, no per-beat tap controls (see §11). The sign-in screen (§8.8) and dashboard (§8.12) are established exceptions to this, but neither is browsable or interactive beyond a single control; all real navigation still happens through the board.
- Not building a custom account system (registration form, passwords, password reset) for v1 — Telegram Login handles identity instead (see §8.8).

## Architecture (locked in)
- Modular monolith: one Node.js backend, clean internal module boundaries — not microservices.
- Client: React Native + Expo (react-native-web for the web target now; native iOS/Android later reuse ~60-80% of this code).
- Database: Supabase (Postgres).
- Full architecture detail: docs/phase-*.md as relevant, and PRD.md §9.

## Working agreement
- Build one phase (docs/phase-N-*.md) per session. Don't try to implement multiple phases in one continuous session — context degrades before you'd finish.
- Each phase file is self-contained: schema, requirements, and the "why" for its area. Read only the phase you're building, not the whole PRD, unless you need to cross-check something specific.
- The full PRD.md stays in the repo as the canonical reference for anything a phase file doesn't cover in enough detail.
