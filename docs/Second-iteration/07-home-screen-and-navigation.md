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

---

## Confirmed implementation notes (build pass)

Recorded during the Part 07 build. Each is a place where the design file (§11)
and the prose above disagreed, or where the design assumed content that doesn't
exist. The prose won in every case; these note what was built and why.

1. **C2 is not shown.** The All Levels grid in Figma carries a seventh
   "C2 / Proficiency" card and the level-test radar draws a C2 spoke, but there
   is no C2 content — `reference-material.json` stops at C1 (366 topics across
   six tiers) and C1 is already the ceiling in §8.11's placement algorithm. A C2
   card would open a level screen with nothing in it, so the tier is omitted
   until content exists. This is the same gap Part 0 records as "No content past
   C1 tier yet — flagged, not resolved."
2. **The radar draws the six real tiers, including B1+.** The design's spokes
   are A1/A2/B1/B2/C1/C2 — dropping B1+ and adding the unreachable C2. The chart
   uses `LEVELS` instead, so every spoke is a tier a student can actually be
   placed on. The radar remains display-only, as §12 requires.
3. **Level names come from the All Levels grid, not the per-level frames.** The
   "Level A1" frame and the "Reveal the result" frame both show A2's name and
   description ("Pre-Intermediate / simple, routine tasks") under an A1 heading.
   The grid is the only place all tiers appear together and is self-consistent,
   so it is the source; the design's "Elementry" is corrected to "Elementary".
4. **Topic titles are derived from `topic_id`.** The content has no display
   title — only the outline (formula, key idea, examples, mistakes) — while the
   design mocks up curated names. Titles are sentence-cased from the id
   (`which_that_vs_what_relative` → "Which that vs what relative"). Long ids give
   long titles; rows truncate.
5. **Topic subtitles are the first sentence of the topic's `key_idea`.** The
   design's mocked subtitles are placeholder filler repeated across unrelated
   rows ("Study of sounds in language" under a grammar topic), so they are not
   carried over.
6. **Language selection offers two options, not three.** The Figma frame lists
   Uzbek, Russian *and* English, which contradicts both the question it is
   captioned with ("Uzbek or Russian?") and §12's rule that a C1 placement skips
   the screen and is assigned English automatically. The two-option prose is what
   is built; English remains the automatic C1 outcome rather than a pick.
7. **The card deck shows Grammar live and the other four inert.** The Figma main
   screen mocks Listening up as in-progress; §9's prose is explicit that for MVP
   a topic's completion "collapses to just Grammar passing" with the other four
   grayed and not tappable, so the prose is what is built.
8. **"Reveal the result" has no readable motion spec.** §12 names that frame as
   the source of truth for the reveal animation's timing and says Claude Code
   pulls it via the §11 Figma access. The frame renders, but exposes no children
   and no motion tracks through the MCP API — there is no timing to read out of
   it. The reveal is built to the frame's composition (headline, tier glyph,
   Bixy) with three timing constants in `RevealResultScreen.tsx`; if the Motion
   spec becomes readable, those constants are what it replaces.
   **This is the one item still genuinely unresolved rather than decided.**
9. **§12 moves the greeting, not the get-to-know-you conversation.** Step 1 puts
   Bixy's greeting ahead of the level check. It says nothing about relocating
   Part 05 §7's five-question meeting, which still runs on the board where Part
   05 put it, gated by `POST /me/greeting` returning `first_meeting`. Flagged
   rather than assumed: if the whole meeting was meant to move ahead of the
   level check, that is a Part 05 change and has not been made.
