# Phase 3 — Board rendering & doodle animation

The core visual experience. Build this against static/sample board
scripts (see the schema example in §8.2) before the AI generation
pipeline (phase 4) exists — you don't need live generation to test
rendering.

### 8.2 Lesson content — "board script"
Every lesson, regardless of source, is represented as a structured document, not prose and not video — the core technical artifact of the product. A lesson runs as **two parallel content tracks**, not one:

- **Story track** — an AI-invented scenario illustrating the topic, delivered as voice narration (text-to-speech) synchronized with doodle elements drawn from a fixed library (see below). Never written on the board as text during discovery itself — the one exception is the recap step (above), where the same sentences get written out afterward.
- **Formal track** — the actual grammar content (title, formula, explanation, examples, common mistakes, check-in questions), sourced from the reference material (§8.1), written on the board as animated, color-coded text (§8.3). This content is never spoken aloud.

A lesson follows a consistent arc, though what fills each part varies by topic (§8.13):

1. **Introduction** — Bixy states what's about to be taught and previews the approach ("I'll show you a few situations, then we'll look at the rule together") before any content begins.
2. **Discovery** — 2 to 4 story beats, scaling with how conceptually hard the topic is, judged from the reference material's own signals (how much the formula and common mistake actually need explaining) rather than a separately-authored complexity tag. Each beat continues the same scene rather than reading as a list of unrelated examples, giving enough repetition to notice a pattern without feeling like padding.
3. **Recap** — the same discovery sentences, now written on the board rather than only spoken, with the specific grammar marker highlighted in blue (§8.3) — one recap beat per discovery beat, matching the 2-to-4 count from step 2, not a single summarized line. A deliberate, narrow exception to "the story track is never written as text" (below) — made specifically because comparing a pattern across sentences is something spoken narration alone can't really support.
4. **Check** — a real check-in question (§8.4) on the discovery content, not a self-report ("did you get it?").
5. **Confirm the rule** — the formal track states the rule explicitly (deductive), the same mechanism as before.
6. **Check** — a second check-in, this time on the formula itself.
7. **Practice and the end-of-topic test** — unchanged in kind, updated in shape (§8.4).

Failing either check doesn't just repeat identical content — it pulls a different stored variant if the pool has one (§9.2), the same principle already used for on-demand re-explanations, since a student who didn't follow it once usually won't get more from hearing the exact same words again.

Illustrative schema:

```json
{
  "topic_id": "present_perfect",
  "level": "A2",
  "beats": [
    {
      "id": 1,
      "type": "formal_beat",
      "style": "title",
      "content": "Present Perfect"
    },
    {
      "id": 2,
      "type": "story_beat",
      "narration": "Today we're looking at present perfect. I'll show you a few situations, then we'll figure out the rule together.",
      "doodles": []
    },
    {
      "id": 3,
      "type": "story_beat",
      "narration": "Diana just got back from a trip. Her friend Marcus wants to know how it went.",
      "doodles": [
        { "element_id": "person_a", "position": "left" },
        { "element_id": "suitcase", "position": "left", "attached_to": "person_a" },
        { "element_id": "person_b", "position": "right" },
        { "element_id": "speech_bubble", "attached_to": "person_b", "text": "How was your trip?" }
      ]
    },
    {
      "id": 4,
      "type": "story_beat",
      "narration": "Diana smiles — the trip already happened, but she's still talking about it right now, so she says it this way.",
      "doodles": [
        { "element_id": "face_happy", "attached_to": "person_a" },
        { "element_id": "speech_bubble", "attached_to": "person_a", "text": "I've visited Samarkand!" }
      ]
    },
    {
      "id": 5,
      "type": "story_beat",
      "narration": "Marcus grins back — he's got a similar story of his own.",
      "doodles": [
        { "element_id": "face_happy", "attached_to": "person_b" },
        { "element_id": "speech_bubble", "attached_to": "person_b", "text": "I've been to Bukhara myself!" }
      ]
    },
    {
      "id": 6,
      "type": "formal_beat",
      "style": "recap_example",
      "content": "I have visited Samarkand.",
      "emphasis": "have"
    },
    {
      "id": 7,
      "type": "formal_beat",
      "style": "recap_example",
      "content": "I have been to Bukhara.",
      "emphasis": "have"
    },
    {
      "id": 8,
      "type": "formal_beat",
      "style": "check_in_question",
      "question": "Which sentence connects a past trip to right now, the same way Diana's and Marcus's did?",
      "options": ["I visited Samarkand last year.", "I have visited Samarkand."],
      "correct_index": 1,
      "wrong_answer_reactions": {
        "0": "That's simple past — it works, but it ties the action to a finished, specific time. Diana and Marcus were both talking about it as something that still matters right now, which needs 'have' or 'has' plus the past participle instead."
      }
    },
    {
      "id": 9,
      "type": "formal_beat",
      "style": "formula",
      "content": "have / has + past participle"
    },
    {
      "id": 10,
      "type": "formal_beat",
      "style": "example",
      "content": "I have visited Samarkand."
    },
    {
      "id": 11,
      "type": "formal_beat",
      "style": "common_mistake",
      "content": "I have visit Samarkand."
    },
    {
      "id": 12,
      "type": "formal_beat",
      "style": "check_in_question",
      "question": "Which sentence is correct?",
      "options": ["I have went to Samarkand.", "I have gone to Samarkand."],
      "correct_index": 1,
      "wrong_answer_reactions": {
        "0": "Ah, close — 'went' is what we'd use for simple past, but since this is still connected to right now, we need the past participle: 'gone.'"
      }
    }
  ]
}
```

Fixed from the previous version: the formula and example no longer appear mid-discovery (previously at beat 3, before the second discovery example had even played) — every discovery and recap beat now comes before the rule is stated at all. Recap now sits right after discovery, not appended at the end. Discovery also gained a genuine second example (Marcus's line) rather than one setup beat plus a single example — two comparable instances is the actual floor for noticing a pattern (§8.2), and the previous version only had one.

One structural clarification this rebuild surfaces: `formal_beat`'s fields aren't identical across every style. Title, formula, explanation, example, common mistake, and recap all use a simple `content` string (plus `emphasis` for recap). `check_in_question` is shaped differently — `question`, `options`, `correct_index`, `wrong_answer_reactions` — since a question isn't a line of text, it's a structured thing with answers. Both are still `formal_beat`, sitting in the same `beats` array in sequence; which fields apply just depends on the `style`. This replaces an earlier note in §8.13 that described check-ins with a mismatched shape (`check_in_id` instead of `id`/`type`/`style`) — that was wrong, this is the corrected version.

Requirements:
- Two beat types: `story_beat` (narration + a `doodles` array of library element references, each with position/attachment and optional bubble `text`) and `formal_beat` (a `style` tag mapping to a color/weight in §8.3, plus either a `content` string or, for `check_in_question`, structured question fields — see above). A beat is one or the other, never both.
- `doodles[].element_id` must reference a valid entry in the doodle library catalog (`doodle-library.json`) — a separate, product-owned asset file alongside the reference material, cataloging each reusable doodle element by ID, category, and description. The AI selects and arranges from this library; it does not generate freeform new artwork per lesson, so a discovery beat's illustration is always the closest existing match, not a bespoke one made for that specific sentence.
- Bubble text (dialogue inside a `speech_bubble` or `thought_bubble`) is rendered but does not use the formal color-coding system in §8.3 — it's part of the invented story, not the taught rule, and is styled as plain, casual text.
- Emphasis highlighting within formal text is back in scope, reversing an earlier v1 decision against it — specifically for the recap step's `emphasis` field, rendered in blue rather than red. Red stays reserved for common-mistake content, so the same color doesn't carry two different meanings depending on context.

### 8.3 Board rendering
- The board is a single, large, mostly-empty canvas filling nearly the whole screen — no panels, sidebars, or chrome competing with it, per the minimalist reference direction provided (see §11).
- Beats render progressively, not instantly: formal text reveals word by word or character by character with a slightly uneven stagger — not a literal pen-stroke simulation (Caveat is a standard filled web font, not a stroke font, so it can't use the same stroke-dashoffset technique as doodles) and not a robotic typewriter blink either. Decided for MVP: this simple staggered reveal, not true stroke-simulated handwriting — cheaper to build and judged sufficient to clear the "not a typewriter blink" bar (§9.1 has the fuller stroke-simulated alternative, parked as a possible future enhancement, not v1 scope). Doodles draw themselves stroke by stroke, in a consistent hand-drawn style rather than sterile/vector-perfect — this is a visual-quality bar, not just a technical one.
- Formal text is color-coded by content type, so the student can tell at a glance what kind of information they're looking at:

| Content type | Color | Weight |
|---|---|---|
| Title | White | Bold |
| Formula / structure | Blue | Semi-bold |
| Explanation | White | Regular |
| Example (correct) | Green | Regular |
| Common mistake (incorrect) | Red | Regular |
| Check-in question | White | Regular |
| Recap emphasis (grammar marker within recap text, §8.2) | Blue | Bold |

The recap emphasis reuses Formula's blue rather than introducing a new color — both represent the grammar structure itself, so the same color already carried the right meaning.

- All formal text uses a fixed, consistent handwriting-style web font: **Caveat** (Google Fonts), rather than a system default.
- Narration audio and doodle animation should be reasonably synchronized within a story beat (visual pacing tied to narration length is acceptable; frame-perfect sync is not required for v1); formal text writing is not narrated.
- The board should visually accumulate through a lesson (like a real whiteboard filling up), not reset between beats.

### 9.3 Why not generate video
This was evaluated and rejected as the primary approach. Video-generation pipelines (whether AI whiteboard-video products or code-rendered video like Manim) produce a fixed artifact: good for a one-off explainer, but incompatible with per-beat replay and re-explanation, which is the product's core differentiator. The structured-board-script approach costs more up-front engineering (a renderer, not just a video player) but is the only approach that supports the interaction model in §8.4, and it maps naturally onto a web canvas.

---

