# Bixy PRD — Part 7: Home Screen & Navigation

> Covers original PRD §9, §11, §12. Read `00-context-shipped-v1.md` first.
> §9 uses the Bixy character from Part 06. §12 is a synthesis that touches
> Part 01 §1 (language tiers), Part 02 §5 (whiteboard narration order), Part
> 04 §6 (quiz), Part 05 §7/§8 (greeting/persona), and §9/§11 below — build
> the individual screens first, then use §12 to wire the actual flow between
> them last.

---

### 9. Home screen redesign

**What changed (v14.12):** Supersedes the original horizontal
Duolingo-style checkpoint path with the layout actually built in Figma
(`BixyAI.fig`, see §11 below) — Level map + Bixy character + swipeable
topic-block cards. The checkpoint-path/auto-scroll-on-completion idea is
dropped entirely in favor of this structure.

Three parts on the home screen:

1. **Level map** — a circular progress indicator showing the student's
   current level (e.g. "A1 level") plus "Click to see the map of all
   topics." Tapping it slides in an **All Levels** screen; tapping a
   specific level there (e.g. B1) slides in that level's own screen, which
   shows the CEFR description and a scrollable list of that level's topics.
   Only the student's **current** level screen auto-scrolls down to their
   in-progress position on open — completed and not-yet-reached level
   screens have nothing to scroll to, so they don't.
2. **Bixy character** (see Part 06 for its animation spec) — tapping it
   opens the **Whiteboard** screen, resuming the lesson exactly where the
   student left off.
3. **Topic-block cards** — a swipeable card deck, one card per topic, each
   showing that topic's 5-part breakdown (icon, title, subtitle, status —
   see below). Swiping reveals adjacent passed/upcoming topics. Upcoming
   topics are visually present but disabled until the current topic is
   passed at ≥80% — the student can still swipe to *see* them, just not
   open them. Tapping a topic's title from its card navigates to that
   topic's level screen (e.g. A1).

**Topic-block card content** — each card shows exactly 5 rows, one per
skill part of that topic, each with an icon, title, subtitle, and
pass/fail/not-yet-attempted status:
- **Grammar** — "Explanation and use cases"
- **Listening** — "Audio clips and comprehension"
- **Speaking** — "Pronunciation and conversation"
- **Reading** — "Passages and comprehension"
- **Writing** — "Sentences and composition"

A topic only counts as complete once all 5 parts pass — **for MVP this
collapses to just Grammar passing**, since the other 4 parts aren't built
yet. Those 4 rows show as grayed/disabled "Coming soon" and are not
tappable.

### 11. Design file reference

**What changed (v14.11):** Records the Figma file holding the finalized
UI/UX design (`BixyAI.fig`) so Claude Code can pull design data directly via
Figma's API/MCP integration during build, rather than trying to read the
local `.fig` file itself — `.fig` is a proprietary binary format that isn't
readable directly from disk, even with local filesystem access; the link is
what actually unlocks the design data, not the file's location on disk.

- Figma file: https://www.figma.com/design/XVBsTWAe9YiZY3Avtrtl6J/BixyAI?node-id=0-1&t=dzmclWNYsBgvibFc-1
- File key: `XVBsTWAe9YiZY3Avtrtl6J`

**Access note:** initially blocked by a permissions error because the
connected Figma account differed from the account that owns this file —
resolved by reconnecting the Figma connector under the correct account.
Read access confirmed working as of this section's last update.

### 12. End-to-end screen flow (onboarding through lesson)

**What changed (v14.12):** Full onboarding-through-lesson flow confirmed
against the actual Figma design (`BixyAI.fig`, §11 above). Reorders language
selection to after the level check, not before.

1. **Greeting** — Bixy's first-meeting greeting (Part 05 §7) plays in
   **English only** — at this point the student's language preference isn't
   known yet, so it can't be localized. Bixy plays its Float+Breathe idle
   only (no Look-Around, per Part 06's standing rule — Bixy is speaking to
   the student). Student taps the Bixy character to proceed to the level
   check.
2. **Level Test** — unchanged placement mechanism (Part 05 §8's verified
   pairs/early-stop algorithm — nothing about the underlying logic
   changes). The screen adds a **real-time radar chart** as a pure
   visualization layer: a sector per CEFR tier grows as questions are
   answered, giving the student a live sense of where they're landing.
   This is a display layer only, not a second scoring mechanism — the
   actual placement decision is still exactly what Part 05 §8 verified.
3. **Language selection** — happens **after** the level check, not before.
   If the student places into A1–B2, Bixy asks (in English) "Which language
   is convenient to learn English, Uzbek or Russian?" — two selectable
   options, unchanged from the existing design otherwise. If the student
   places into **C1**, language selection is skipped entirely and English
   is assigned automatically, since C1 is already the "fully English, no
   localization" tier (Part 01 §1).
4. **Reveal the Result** — plays an animation showing the student's placed
   level, then auto-advances to the Main screen with no tap required. The
   animation itself is built in Figma Motion inside this file (frame
   "Reveal the result") — rather than hand-specifying its timing here, this
   section just points at that frame as the source of truth; Claude Code
   pulls it directly via the same Figma access set up in §11 above.
5. **Main screen** — see §9 above.
6. **Whiteboard** — confirmed against the uploaded screenshot; content order
   matches Part 01 §1 / Part 02 §5 / Part 04 §6 (title, story doodles,
   examples, check-in, formula, explanation, common mistakes, check-in,
   test). One interaction detail: the **Formula** block's narration plays
   automatically regardless of interaction; the "👀 Reveal" button
   underneath is separate — it swaps the abstract formula display for a
   worked real-world example populating the same slots (e.g. abstract
   "Question word + Auxiliary verb + Subject + Main verb + Object +
   **Preposition**" reveals as "Who + do + you + sit + at lunch +
   **with?**"), and the button relabels to "Okay, got it" once revealed.
7. **Level screens** — see §9 above; only the student's current level
   screen auto-scrolls to their position on open.
