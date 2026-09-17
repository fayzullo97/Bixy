# Figma gap report — Level Test and Whiteboard screens

Investigation only (testing-pass items 4 and 7). Nothing was rebuilt.

Source: `BixyAI` file key `XVBsTWAe9YiZY3Avtrtl6J` (Part 07 §11), pulled
2026-09-17 via the Figma MCP `get_metadata` + `get_screenshot`.

**Two caveats on method, stated up front:**

1. **No screenshots were attached to the request.** Both items said "screenshots
   attached"; nothing came through. The comparison below is Figma frame vs. the
   current source, not Figma vs. your captures. If your screenshots show
   something the code doesn't imply, that difference is not in this report.
2. **The Figma MCP hit its Starter-plan call limit partway through.** The Level
   Test frame was pulled complete (metadata + render). The Whiteboard frame's
   full node tree was pulled, but only the Story/Doodle section could be
   rendered — the check-in card, Formula, and Explanation renders were refused
   by the rate limit. Claims about those three are from the node tree (names,
   nesting, sizes), not from pixels, and are marked where that matters.

---

# Item 4 — Level Test screen

Figma frame **`Level test` `1:2370`**, 390×844. Current implementation:
`app/src/screens/LevelCheckScreen.tsx` + `app/src/board/LevelCheckBoard.tsx`.

## Node by node

| Figma node | What it is | Current implementation | Verdict |
|---|---|---|---|
| `1:2371` Group 6, `1:2376` Group 4, `1:2384` Group 5, `1:2391` Group 3 | Four decorative cloud/hill vector groups over a cyan→white wash | `SkyBackground` — same gradient, same four cloud assets, placements in the design's proportions | **Matches.** Not a gap. |
| `1:2400` Frame 4 (390×49 at y=24) → `1:2401` text "Level Test" (113×29, centred) | Header bar | `<Text style={styles.title}>Level Test</Text>`, fontSize 24, centred, `marginBottom: space.sm` | **Close.** Two differences: the string is hardcoded English rather than going through `strings[language]`, and there is no 49px header frame — the title sits directly in the column. |
| `1:2402` instance "Frame 58", 240×240 at (75, 85) | Radar chart | `<RadarChart answered={answered} size={240} />` | **Size and position match.** Spokes differ: Figma draws A1/A2/B1/B2/C1/**C2**; the implementation draws `LEVELS` — A1/A2/B1/**B1+**/B2/C1. This is already a recorded, deliberate deviation (Part 07 §11 confirmed-notes 1 and 2: there is no C2 content, and B1+ is a real tier). **Not a new gap.** |
| Radar tier labels | Inactive tiers in pale blue; the reached tier ("A2" in the mock) in saturated violet | Not differentiated by reached tier | **Gap, cosmetic.** |
| `1:2403` instance "Stacked cards", 373×314 at (10, 337) | A single white card, radius ~24, drop shadow, with a second card edge visible behind it — one question at a time, deck-style | `LevelCheckBoard` renders an append-only `ScrollView` timeline: an intro `NoteCard`, then every question card and its answer accumulating down the screen, then a "Placed at X" note | **Largest structural gap.** The design is a one-question-at-a-time card deck; the build is a scrolling transcript of the whole attempt. |
| Inside the card: "Level test" eyebrow (small, blue/teal) | Section label above the question | No eyebrow label | **Gap, cosmetic.** |
| Inside the card: question text, bold, dark, 2 lines — *"Which sentence correctly puts the preposition at the end of the question?"* | A **multiple-choice** question stem | The bank is fill-in-the-blank: `level_check_questions.prompt` is a cloze stem (*"He ___ (always / check) his email in the morning."*) and `LevelCheckBoard` builds `type: 'fill_in_the_blank'` with `accepted_answers`, graded by typed input via `POST /assessment/grade` | **Fundamental content-model gap — the headline finding.** |
| Inside the card: three option rows (326×40 each, 44px pitch), rounded, 1px border; the first filled pale green with green text (the chosen/correct one), the other two white with grey border | Three MCQ buttons + correct-state styling | No option rows exist — the student types into an input and gets a graded result | **Gap, follows from the row above.** |

## What actually has to change, and what it costs

**The screen doesn't mismatch the design so much as the question format does.**
Everything else on this screen is a styling job; this one isn't:

- The 60-question bank in `reference-material.json` / `level_check_questions`
  carries `prompt` + `accepted_answers` only. **There are no distractors.**
  Rendering three buttons means authoring two wrong options for all 60
  questions, plus a schema column and a seed change — content work, not UI work.
- Grading changes shape too. `POST /assessment/grade` exists specifically to do
  fuzzy matching on typed text with an AI fallback; MCQ grading is an index
  comparison and wouldn't use it. The endpoint stays for lesson check-ins, but
  the level check would stop calling it.
- None of this touches `decideNext` — it consumes `{level, correct}` and does not
  care where `correct` came from.

The card-deck vs. transcript difference is independent of that and is a
self-contained rewrite of `LevelCheckBoard`'s render (keep the algorithm and the
seen/placement wiring; replace the accumulating `items` list with a single
current-question card).

**Honest scope read:** cosmetic items (eyebrow label, header frame, localized
title, active-tier label colour) are perhaps half a day. The card deck is a day.
The MCQ conversion is a content project before it is a code change, and it
should be decided as a product question — the design assumes a question format
the product does not currently have.

---

# Item 7 — Whiteboard screen

Figma frame **`Whiteboard` `1:2654`**, 390×**3048** (a tall scrolling lesson).
This was your live Figma selection when I pulled the file. Current
implementation: `app/src/board/Board.tsx` and the doodle renderer.

## What the design is

Structure from the node tree, top to bottom:

- `1:2657` "Buttons [1.1]" — a back control at y=50
- `1:2655` Frame 20 (390×780) — a board surface vector behind the content
- `1:2659` Frame 4 → `1:2660` topic title, 358 wide, 78 tall (two lines)
- `8:2585` **Story | Doodle** (390×612) — two stacked 306px panels, each a
  labelled illustration: `1:2661` "Which:" and `1:2977` "With:", with three and
  two illustration groups respectively
- `1:4001` **Examples** — a heading plus three example lines, with
  `<emphasis>` markup inside two of them
- `1:4015` **Check-in question** — a `question block` card (358×233) holding the
  label, the stem, three `Buttons [1.1]` instances at 44px pitch, and below it a
  separate `Result` row (`1:4025` "Exactly right!")
- `1:4026` **Formula** — a single 358×170 component instance
- `1:4028` **Explanation** — heading, body copy, then two nested example cards
  labelled "Example 1 of 2" / "Example 2 of 2", each with a caption strip beneath
- `1:4045` **Common mistakes** — two cards, "Wrong" and "Correct", each with a
  caption strip
- `1:4061` a second check-in, `1:4070` a second result row
- `1:4072` **"Let's start the test"** — "Question 1 of 12" and "Question 2 of 12"
  cards, same 233px card shape
- `1:4006` a hidden (`hidden="true"`) earlier variant of the check-in block
- `1:4090` "Prompt Area / AI Template" instance (374×114) pinned at the bottom

## The three differences you named — all confirmed

**1. Theme.** Confirmed, and it is the big one. The rendered Story/Doodle section
is pure white ground with black ink. `app/src/theme.ts` says so explicitly in its
own header: *"The board and the pre-redesign screens are dark (`#12151c`);
everything §9 covers is the light sky palette below… the two palettes coexist
until the board itself is restyled."* `Board.tsx:642` is `backgroundColor:
'#12151c'`. So the board being dark is a known, documented, deliberate state —
the design has always been light and the board was never converted. This is not
drift that crept in; it is a conversion that was scheduled and not done.

**2. Styled cards vs. plain text.** Confirmed from the node tree. Every content
unit in Figma is wrapped in a card: `Frame 26` → `Frame 27` with 16px padding, a
233px standard card height for question blocks, a separate caption strip
(`Frame 34`/`36`/`38`/`40`) under each example, and a distinct `Result` row for
feedback. The board renders these as flat text sections against the dark ground.
*(Node tree only — the rate limit blocked rendering these frames, so I have their
structure and sizes but not their fills, radii, or shadows.)*

**3. Illustrated characters vs. the doodle library.** Confirmed, and this is the
gap that is least like a styling change. The Figma story panels are detailed
hand-drawn portraits — a bearded man in round glasses, a woman in sunglasses with
shoulder-length hair, a cottage with a shaded roof, garden shrubs and smoke
curling from the chimney. The library is `doodle-library.json`: **20 generic
assets total** (`person_a`, `person_b`, `person_sitting`, `house`, `speech_bubble`,
`thought_bubble`, four faces, and utility glyphs). They are line drawings rather
than literal stick figures, but they are deliberately generic and reusable — one
`person_a` stands in for every character in every lesson. The design's
illustrations are per-scene, characterful, and not reusable.

## Is this a small fix or an unscoped reskin?

**It is an unscoped full reskin, and I'd push back on treating it as a fix.**
Three independent bodies of work, only one of which is UI:

1. **Theme conversion.** Every colour in `Board.tsx`'s stylesheet is written for a
   dark ground — text, the prompt bar, quiz option states, the `rgba` overlays,
   the Part 08 §15 grid painted across the content box. Inverting it is
   mechanical but touches the whole file, and the doodle SVGs are black-on-white
   art currently rendered on dark, so their treatment changes with it.
2. **Card system.** A real component layer that does not exist yet: card, caption
   strip, result row, and the "Formula" component, applied across seven distinct
   content block types.
3. **Illustration library.** This is not a code task. Matching the design means
   commissioning per-scene artwork, or accepting that the generic library is what
   ships and the design's illustrations are aspirational. Twenty reusable assets
   and per-lesson bespoke drawings are different products with different costs,
   and the generation pipeline picks from a fixed catalogue by `element_id`.

Items 1 and 2 are a genuine, sizeable build. Item 3 is a content and budget
decision that should be made before any of it starts — and it is the one that
determines whether the screen can ever actually match the frame.

**Recommendation:** split this. Theme + cards is a scoped piece of work that can
be specced and estimated. The illustration gap should be decided separately and
explicitly, the same way Part 07 §11's confirmed-notes recorded the C2 and
language-selection mismatches rather than silently building to the mock.
