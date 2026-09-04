# Product Requirements Document: Whiteboard AI Tutor

*(Working title — product/brand name TBD)*

| | |
|---|---|
| **Status** | Draft v13.1 |
| **Author** | Fayzullo |
| **Date** | August 17, 2026 |
| **Product area** | New product — AI-native education |
| **Primary market** | Uzbekistan (self-study English learners), extensible to other subjects/markets |
| **v13.1 changes** | Locked the two remaining architecture decisions into §9.1: a modular monolith (one Node.js backend, clean internal module boundaries, not split into separate deployed services), and React Native + Expo as the client — used for the web app now, not just the native apps planned later — chosen specifically for the 60-80% code-sharing this gives once mobile gets built. Confirmed the existing CSS-based draw-in animation still applies to the web/react-native-web target unchanged; native iOS/Android remain out of scope until the mobile phase (§6.2) |
| **v5.0 changes** | Added Level check as a new section (§8.11): an adaptive placement test across the six CEFR tiers already in the reference material (A1/A2/B1/B1+/B2/C1 — corrected an earlier assumption of five), using pregenerated fill-in-the-blank questions rather than multiple choice specifically to avoid lucky guessing, graded by a deterministic pass with an AI fallback for ambiguous answers. Algorithm: opening round from A1/B1/C1, pairs-of-2 evaluation with early-stop at 40-60% accuracy over 4+ questions, a 15-question hard cap, and final placement at the highest level not clearly cleared. Updated §6.1, §9.1, §12, §13 |

---

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

## 3. Goals

### Product goals
- Let a student request any English grammar topic in plain language and receive a whiteboard-style explanation: written, drawn, and narrated, not just text.
- Let a student ask for any part of a lesson to be re-explained — by tapping it directly (future) or simply asking, as in v1 — and have the board respond with a replay or an alternate explanation.
- Make the explanations feel hand-made — progressive, human-paced drawing and narration — not like a slideshow appearing instantly.

### Business goals
- Validate a self-study product for the Uzbekistan English-learning market, consistent with the company's existing focus on that market.
- Build a content/technical foundation (the "board script" format and renderer) that is not English-grammar-specific, so the same engine can extend to other subjects later.

### Success metrics
None of these require new instrumentation beyond what the architecture already produces (progress records — §8.9); they're just worth watching once there's real usage:

- **Lesson completion rate** — of lessons a student starts, what share reach the end-of-topic quiz rather than being abandoned mid-way. The most basic signal that pacing and content quality hold attention.
- **First-attempt quiz pass rate** — the share of students scoring 80%+ on their first try at a topic. Tells you whether the teaching is landing, not just whether the app runs.
- **Retake improvement** — for students who score under 80% and get re-taught, does their score go up on the next attempt? The single most important number for this product specifically — a direct test of whether paced, checked, adaptive teaching actually works better than a one-shot explanation.
- **Per-concept miss rate** — which specific beats or quiz questions get missed most often, aggregated across every attempt. More operational than a success metric: it points at exactly where the reference material or an explanation needs work.

Once more than one real student is using it, add **return rate** — does a student who finishes one topic come back for another — as the metric that speaks to the business goal above, not just whether the product mechanic works.

### Non-goals (for v1)
- Not a general-purpose chatbot; the interaction model is "pick or ask for a topic," not open-ended conversation.
- Not a live human-tutor marketplace or classroom/multi-student product.
- Not attempting full curriculum breadth (reading, writing, listening, speaking) — v1 is grammar explanation only, deliberately: the intended long-term product covers all of these, but grammar is the starting point, not the ceiling (§6.2).
- Not supporting arbitrary subjects at launch — architecture should allow it later, but content investment in v1 is English grammar only.
- Not building any interface beyond the single input on the board itself — no topic browser, no visible settings, no per-beat tap controls (see §11). The sign-in screen (§8.8) and dashboard (§8.12) are established exceptions to this, but neither is browsable or interactive beyond a single control; all real navigation still happens through the board.
- Not building a custom account system (registration form, passwords, password reset) for v1 — Telegram Login handles identity instead (see §8.8).

---

## 4. Target users

**Primary persona — the self-study learner.** An Uzbek speaker learning English independently (school-age through adult), motivated but without regular access to a human tutor, using a phone as their primary or only device. Comfortable with apps like Duolingo but frustrated by tools that only test them rather than teach them. Wants an explanation they can actually understand, at their own pace, in their own time, without embarrassment about asking "again."

**Secondary persona — the supplementing student.** Someone taking English classes (school, prep courses) who uses the app between lessons to firm up a specific grammar point they got wrong on a test or didn't fully follow in class.

---

## 5. Competitive landscape

| Product / category | What it does | Gap relative to this product |
|---|---|---|
| **Khanmigo** (Khan Academy) | Text-based, Socratic AI tutor across many subjects; guides with questions rather than direct explanations | No visual whiteboard or diagrams in the tutor itself; leans on a separate library of pre-recorded human videos for anything visual |
| **AI whiteboard-video generators** (Golpo, Knowlify, Simi/Lamina Labs, Powtoon's AI suite) | Turn a prompt or document into a rendered whiteboard-style explainer video | Output is a locked video file — no way to interactively re-explain a specific segment without regenerating the whole thing; built for marketing/course content, not tutoring |
| **LLM-writes-animation-code projects** (TheoremExplainAgent, MathMatrixMovies, Math-To-Manim) | Academic/hobbyist projects where an LLM writes code (e.g. Manim) that renders a narrated animation | Validate that "LLM produces structured drawing instructions, code renders them" is a reliable pattern (one benchmark reports over 90% success generating long-form theorem videos) — but these render to video, not a live, replayable canvas |
| **General duolingo-style apps** | Gamified drilling and testing | Test comprehension, don't really *teach* a confusing grammar point from scratch |

**Positioning:** this product sits in the gap between "visual but not interactive" (video generators) and "interactive but not visual" (Khanmigo-style chat tutors).

---

## 6. Scope

### 6.1 MVP scope
- Ships as a **web app**, not a native mobile app — used in a desktop or mobile browser.
- Interface is a single, large, mostly-empty board with **one text input control** anchored at the bottom of the screen — no other visible tools (see §8.4 and §11).
- Every lesson is grounded in one source — the product's own curated reference material (§8.1), not the model's raw memory. The student points at a topic within it in one of two ways: typing free text, or attaching a photo of a blackboard, textbook page, or notes for topics they've seen but can't name — the photo identifies the topic, it doesn't introduce separate grounding content.
- App renders each lesson as a sequence of whiteboard "beats": text appearing progressively, diagrams drawing themselves stroke by stroke, underlines/highlights appearing at the right moment — synchronized with narrated audio.
- Teaching pauses for a short, ungraded comprehension check between concept chunks — the lesson doesn't continue until the student answers (see §8.4).
- Each topic ends with a 10–15 question test (blended multiple choice, true/false, and fill-in-the-blank); the score decides whether the topic is marked passed, specific parts get re-taught, or the whole topic repeats (see §8.4).
- The app sits behind a sign-in gate; for v1 this is Telegram Login — one-click sign-in via an existing Telegram account, no separate username/password to create (see §8.8).
- Progress — completed topics, quiz scores, mastery status — is saved incrementally as the student works, not just at the end, so nothing is lost if the tab closes (see §8.9).
- The student asks for a topic, asks about the current lesson, or asks for something to be explained again — all through the same input, not a separate control per action.
- Student-selected app language (English, Uzbek, or Russian) drives spoken narration and UI copy; written board content stays English regardless (see §8.7).
- After signing in, an adaptive level check places the student at one of six CEFR tiers (A1 through C1) using pregenerated fill-in-the-blank questions — the student can skip it as a self-identified beginner, or retake it later to update their placement (see §8.11).
- From that placement, a fixed, ordered study plan walks the student through one topic at a time — no browsing, no choice, and no advancing past a topic without passing its quiz (see §8.12).

### 6.2 Phase 2 and beyond (explicitly out of scope for v1)
- Native mobile app — including reworking the board's draw-in animation for it: the web version's CSS technique (§9.1) doesn't exist on iOS/Android, and would need a native-capable approach (e.g. React Native Skia) built specifically for that phase, not solved ahead of time.
- Speaking, listening, reading, and writing sections — confirmed as the intended long-term shape of the product (grammar is the deliberate starting point, not the whole plan), but not scoped or designed here. The dashboard (§8.12) is also deliberately left minimal until this expansion happens, since a fuller dashboard makes more sense once there's more than grammar progress to show.
- Any additional visible tool beyond the single input — topic browser/list, level picker, settings panel, or per-beat tap-to-replay controls.
- Expansion to other subjects using the same board-rendering engine.
- Spaced repetition or personalized topic recommendations built on top of progress history.
- A visual admin tool for managing topic ordering and the prerequisite pins by hand — v1's ordering is computed automatically from naming and a short pin list (§8.12), not maintained through a UI.
- Randomized or regenerated quiz questions on topic retakes — v1 reuses the same question set every time (see §8.4).
- Vocabulary content — confirmed as a future addition, but as its own content structure, not squeezed into the grammar-outline schema (§8.2), which was designed around grammar rules specifically.
- Multi-student/classroom features, teacher dashboards.
- Persisting a student's uploaded topic-identification photos as an ongoing library — v1 uses each one transiently, for a single request (§8.1).
- Offline mode.

---

## 7. Core user flow

1. Student signs in with one tap via Telegram (§8.8) and picks their app language.
2. If the student doesn't yet have a placement, a level check runs right away — an adaptive fill-in-the-blank test, or a skip straight to A1 for a self-identified beginner (§8.11) — no introduction or ceremony first, just the test. This produces a study plan: a fixed, ordered path through the reference material starting at their placed level (§8.12).
3. The student lands on the dashboard — progress and results, not a browsable topic list — with one control that goes straight to the board.
4. On the board, Bixy greets the student by name and asks whether to continue with their current path topic (§8.12) — the same rendered-question mechanism used for check-ins (§8.4), not a separate screen or prompt style. The very first time this happens for a student, that greeting is the introduction — Bixy's name and a short line on what it can help with — folded into the opening of the first lesson itself, followed by a brief, skippable get-to-know-you conversation (hobbies, occupation, interests, where they study, why they're learning), rather than a separate ceremony before any of this (§8.13). Every visit after the first is just the plain continue-prompt.
5. Agreeing plays the lesson in chunks: the board draws and narrates each part at a natural pace, grounded in the reference material, pausing after each chunk for a quick check-in before continuing.
6. Once the lesson is fully covered, the board gives a 10–15 question test, blended across question types. Below 50% re-teaches the whole topic; 50–79% re-teaches just the missed parts; 80%+ marks it passed (§8.4) and advances the study plan (§8.12) — the board then asks, the same way, whether to continue straight into the next topic, rather than sending the student back to the dashboard to choose.
7. At any point, the student can type a follow-up in the same input — "explain that again," or something specific like "what does 'past participle' mean?" — and the board responds by replaying or adding to the current lesson.
8. The student can also type a new topic, or send a photo of something they saw elsewhere, to take a detour from their path (§8.1) — that lesson runs the same way, quiz included, and is recorded as passed the same way a path topic would be (§8.9). Once it wraps up, the board offers to pick back up where the path was left, using the same continue-prompt. If the path later reaches a topic already covered this way, it's skipped silently rather than re-taught.
9. Progress is saved as the student goes (§8.9) — closing the tab mid-lesson and signing back in later resumes from the last point reached, rather than starting over.

---

## 8. Functional requirements

### 8.1 Content sources
Every lesson is grounded in one source — the product's own curated reference material — not the model answering from raw memory. What varies is how the student points at a topic within it: by typing, or by sending a photo. **Which topic gets taught next by default is the study plan's job, not this section's** (§8.12) — typing or sending a photo here is specifically for a topic *outside* the student's current path position, a detour the plan picks back up from afterward, not the primary way topics get chosen.

- **Typed request.** The student types what they want — a topic name ("present perfect"), a question about the current lesson, or a request to re-explain part of it. This is the main way to type anything into the app (§8.5), whether that's a detour topic or a follow-up on the current one.
- **Photo request.** The student can instead attach a photo — of a school blackboard, a textbook page, or handwritten notes, whatever they were looking at when they got stuck — instead of typing. The app reads the photo to identify which grammar topic it shows, then teaches that topic exactly the way a typed request would, from the reference material — the photo is never itself the grounding content, only a way to point at a topic without knowing its name. This exists specifically for a student who encountered something at school or in a book but doesn't know the term for it well enough to type it — turning "I don't know what this is called" into a valid way to ask, rather than a dead end (this also meaningfully narrows the open question in §13 about students not knowing grammar terminology).
  - If the photo doesn't clearly correspond to a topic in the reference material, or is unreadable, the app says so plainly — the same "I don't have information about that" principle as an off-topic typed request, not a guess and not a silent fallback.
  - The photo is used once, to identify the topic for that single request. It isn't retained as an ongoing grounding source the way the earlier PDF-upload design would have kept a coursebook for a whole session — a later request in the same session doesn't implicitly still refer back to an old photo.

**Reference material.** The product's own curated, lean per-topic outline — original content or openly-licensed, never an arbitrary copyrighted textbook (see §12 for why that distinction matters). This is deliberately lean: per topic, just the formula, the key idea, one or two examples, and the common mistake — a short outline, not a written-out explanation. The AI still generates the full lesson — pacing, narration, extra examples, diagrams — live; the outline is just a small, reviewable anchor so that generation doesn't drift, not a script it reads aloud. Authored directly rather than extracted from a document, so it's stored as structured JSON, one object per topic. Each field is explicitly labeled, so the model isn't left guessing which part of a paragraph is the formula versus an example versus a mistake:

```json
{
  "topic_id": "present_perfect_tense",
  "level": "B1",
  "formula": "have / has + past participle",
  "key_idea": "Connects something from the past to right now — the exact time usually doesn't matter, but the present relevance does.",
  "examples": [
    "I have visited Samarkand.",
    "She has lived here since 2020."
  ],
  "common_mistakes": [
    "Saying 'I have went' instead of 'I have gone'.",
    "Using present perfect with a specific past time word like 'yesterday' — that needs simple past instead."
  ]
}
```

Requirements:
- The curated reference material is a product-owned asset — a lean per-topic outline, written and reviewed once, then reused for every lesson — not regenerated per student, and not meant to be exhaustive prose.
- Stored as rows in Supabase (one per topic, matching the JSON shape above), which also sets up cleanly for the future admin panel (§6.2) to list, add, and edit topics.
- Each topic needs a stable `topic_id` (a consistent slug, e.g. `present_perfect_tense`), reused across the outline, the board script (§8.2), and quiz question tagging (§8.4), so the same topic is always referenced the same way.
- While the topic count is small, include the full set of outlines in context for every request rather than building a lookup/search step — prompt caching keeps this cheap (§9.2), and it avoids a retrieval system that isn't needed yet. Worth revisiting only if the topic count grows into the hundreds.
- Scope is grammar only for v1 — no vocabulary, no pronunciation. If a request (typed or photo) falls outside English grammar, or is unrelated entirely, the app doesn't attempt an answer: it responds with a plain "I don't have information about that" and stops there, rather than reaching outside its grounding to improvise.

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

### 8.4 Pacing, comprehension checks, and assessment
Teaching moves in small chunks, not one continuous narration — this is the main fix for a lesson feeling rushed or one-sided.

- **Pacing.** Beats should be full enough to actually explain the point, not just label it, and the board should never race ahead of its own narration. A lesson opens by framing why the topic matters before it states any rule, so the student has a reason to care before being asked to absorb detail.
- **Check-ins (formative, ungraded), at two fixed points in the lesson arc (§8.2)** — once after discovery/recap, once after the formal track confirms the rule — rather than scattered after every small chunk. Each is a real test question, not a self-report ("did you get it?") — often multiple choice — and the board waits for an answer before continuing. Getting it wrong doesn't penalize the student; it triggers a clarification tailored to the specific wrong answer given (§8.13), then re-teaches that part of the lesson using a different stored variant if the pool has one (§9.2) — not the identical content the student already couldn't follow.
- **End-of-topic test (summative, graded).** Once every beat is covered, a test of 10–15 questions — the count scaling with topic complexity the same way discovery-beat count does (§8.2) — with blended question types (multiple choice, true/false, and fill-in-the-blank), not multiple choice alone. Fill-in-the-blank questions reuse the same grading approach already built for the level check (§8.11): a predefined accepted-answers list checked first, an AI judgment call as the fallback for anything that doesn't match. Each question is tagged to the specific beat(s) it tests:

```json
{
  "quiz_question_id": 1,
  "type": "multiple_choice",
  "question": "Which sentence is correct?",
  "options": ["I have went to Samarkand", "I have gone to Samarkand"],
  "correct_index": 1,
  "tests_beat_id": 6
}
```

- **Mastery branching**, based on the test score:
  - Below 50%: re-teach the whole topic from the start. For v1, a retake reuses the same question set rather than a freshly generated one — question randomization is a fast-follow, not a launch requirement (§6.2).
  - 50–79%: re-teach only the concepts tied to the questions the student missed, using the beat-tagging above.
  - 80% and above: mark the topic passed and advance to the next topic in the student's study plan (§8.12).

Requirements:
- Quiz and check-in questions are generated from the same reference material grounding the lesson (§8.1), never invented independently, so they can't test something the lesson didn't actually cover.
- Check-ins and the quiz both live within the single-input, single-board interface (§8.5, §11) — rendered as part of the board experience, not a separate quiz app bolted on.
- Mastery results are part of the student's progress record (§8.9), tied to the signed-in session, so they persist rather than resetting every visit.

### 8.5 The input — the only tool
For v1, the bottom of the screen holds exactly one control: a text input where the student can type anything — a new topic ("explain present perfect"), a question about what's currently on the board, or a request to go back over something ("can you explain the timeline part again?"). There is no separate topic browser, settings panel, or per-beat button set in v1; re-explanation is requested through the same input rather than a dedicated tap-to-replay control. Check-in and quiz answers are the one exception — those are selected from on-board options, not typed (§8.4).

Requirements:
- The input accepts free text and a photo attachment from the same control — typing a topic or attaching a photo of a blackboard/textbook page (§8.1) are both first-class ways to ask, not a second tool bolted on.
- Submitting a new question while a lesson is on the board should feel like a continuation, not a reset — prior context (and the board itself) should remain unless the student clearly starts a new topic.
- No other visible controls ship in v1: no topic list, no level picker, no history panel. Anything beyond the single input and the check-in/quiz options is explicitly deferred (see §6.2).

### 8.6 Content quality
- Every lesson is grounded in the reviewed reference material, not the model's unguided memory — carries a lower hallucination risk by construction, and is reviewed once, on creation and on update, rather than reviewing individual generated lessons (see §9.2 and §12).
- The photo-request path (§8.1) adds a different quality question, not a grounding one: whether the vision step correctly identifies the topic from a real-world photo (bad lighting, glare, messy handwriting, an awkward angle) — worth testing specifically before launch, separate from the reference material's own accuracy, which is already validated (§14).

### 8.7 Narration and localization
- The student selects an app language — English, Uzbek, or Russian, matching what VoiceLab (§9.1) supports on one voice model — during sign-in (§8.8), before the board loads.
- That selection affects only the story track's spoken narration (the `story_beat.narration` field, §8.2) — the voice explaining the topic. All written board content stays in English regardless of the selected language: the formal track (title, formula, explanation, example, common mistake, check-in question), speech/thought bubble text, and quiz question stems and options are always English — that's the target-language content itself, not the explanation of it, and it doesn't change based on what language the student is learning *through*.
- Within a non-English narration, specific English words or phrases the narration needs to reference — the grammar marker or example being discussed — are spoken in correct English pronunciation, not in the surrounding language's accent. For example, an Uzbek narration explaining present perfect still says "have" and "visited" the way an English speaker would, mid-sentence, not a phonetic Uzbek approximation. **Confirmed working**: Fayzullo tested this directly against VoiceLab's demo with mixed Uzbek/English text — `Lison` handles the code-switching from the text itself, correctly, with no special tagging needed.
- **Known characteristic:** in the same testing, VoiceLab's English output (tested as pure English text, not just embedded words) carries a slight Uzbek accent — likely intentional given the product is tuned for the Uzbek market rather than a defect to chase a fix for. This mainly affects narration when English is the selected app language; it doesn't touch pronunciation of the actual English being taught, since that content (formulas, examples, quoted forms) lives on the silent formal track and is never spoken by TTS (§8.2) — only the illustrative story narration is affected, not the target-language content itself.
- UI chrome (buttons, labels, the sign-in screen itself) also follows the selected language — a standard i18n string table, independent of the AI-generation and TTS pipeline.
- This supersedes the earlier, narrower framing of an occasional Uzbek/Russian aside on hard points (§13) — language selection now applies by default to all spoken narration, not just difficult moments.

### 8.8 Authentication
Sign-in is exclusively through **Telegram Login** — a student authorizes with their existing Telegram account in one tap; there's no separate username/password to create, and no other sign-up path in v1.

- **Requires a Telegram bot.** Telegram Login is built around a bot that represents the app — this isn't optional infrastructure, it's how the login flow identifies itself to the user. Telegram's own guidance: the bot's profile picture should match the app's logo and its name should make the connection obvious, since the student sees a confirmation box naming that bot when they log in — an unfamiliar bot name/photo makes people less likely to authorize. Created and configured via [@BotFather](https://t.me/botfather); registering the app's URL(s) there (Login Widget section) is what produces the Client ID and Client Secret the integration needs.
- **Integration: the Telegram Login library** (`Telegram.Login.init` / `.open` / `.auth`), per Telegram's current docs (https://core.telegram.org/bots/telegram-login — this replaced an older iframe-widget approach, now archived). Decided over building against Telegram's OpenID Connect endpoints directly: OIDC's main advantage is treating each provider generically, interchangeable with Google or GitHub behind the same plumbing — but Telegram is the only identity provider this app is ever using, not one of several, so that genericness buys nothing here. The library is also just less to build.
- **What the login grants access to is scope-based, requested explicitly at login time** — not everything comes back automatically:
  - `profile` — id, name, username, and a profile photo URL. This is the baseline scope this app needs.
  - `phone` — the student's verified phone number, gated behind separate user consent. Not clearly needed for anything in this PRD yet — pulling it just because it's available would be collecting more than the app uses (see §13).
  - `telegram:bot_access` — lets the same bot send the student a direct message after login. Decided against for v1: scope stays login-only, since there's no messaging feature in this PRD to use it for yet. Nothing about the bot itself changes if this gets added later — it's the same bot either way, just an additional scope requested at login, not a second bot.
- **What actually comes back, and what doesn't.** The `profile` scope returns: Telegram user ID, full name, username, and a profile photo URL (hosted on Telegram's own CDN — the app can hotlink or cache it, doesn't need to). **There is no birthday or date-of-birth field anywhere in Telegram's login data** — it isn't part of `profile`, `phone`, or any other scope. If date of birth matters for anything (it doesn't appear to, elsewhere in this PRD), it would have to be collected separately, directly from the student, not pulled from Telegram.
- **Server-side validation is mandatory, not optional.** The login returns a signed JWT (`id_token`, RS256 by default). The backend must independently verify it — check the signature against Telegram's public keys, confirm the issuer is Telegram and the audience matches this app's bot, and check it hasn't expired — before trusting anything in it. Skipping this step means trusting whatever the client claims, which defeats the point of using Telegram as the identity source.
- Sign-in is a separate, minimal screen shown before the board — it isn't part of the board's single-input interface (§11), it's a gate in front of it.
- The sign-in screen also collects the student's app language (§8.7) — English, Uzbek, or Russian — before the board loads, since narration generation afterward depends on knowing which language to speak in. Telegram's own login data doesn't carry a language preference, so this stays a separate step either way.
- Sign-out is a small, unobtrusive control, not a toolbar addition to the board itself — a quiet link, not a button competing with the single input.

Requirements:
- A signed-in session persists across page reloads within the browser, so the student isn't asked to sign in every visit.
- Progress records (§8.9) and variant-seen tracking (§9.2) key off the student's Telegram user ID — a real, durable identity, not a workaround. This also fully retires the earlier concern (§12) about manually-provisioned test credentials not scaling: any real Telegram account is a genuinely distinct student, with no per-tester setup needed.
- The name, username, and profile photo URL from the `profile` scope are stored against the student's record and usable within the app (e.g. a greeting, an avatar) — see §9.1 for where this lives.
- Signing out is explicit and doesn't delete any saved progress (§8.9).
- Telegram becomes the only way in — there's no fallback for a student without a Telegram account. That's a deliberate v1 bet, not an oversight; see §12 for the risk this carries and why it's judged acceptable for this market.

### 8.9 Progress saving
Progress — which topics are done, quiz scores, mastery status, and where the student is mid-lesson — needs to survive the student closing the tab.

The reliable way to do this is not a single save triggered right as the tab closes: that moment (the browser's `beforeunload` event) is well known to fail to fire consistently, especially on the mobile browsers this app's target persona actually uses (§4). Instead:

- Save incrementally, as the student moves through a lesson — after each beat finishes, after each check-in answer, and after the quiz completes — rather than saving once at the end.
- Treat closing the tab mid-lesson as the normal case to design for, not an edge case: whatever was last saved is exactly where the student picks back up.
- A best-effort save on tab close/hide is still worth having as a backstop (the `visibilitychange` or `pagehide` events behave more consistently than `beforeunload`, particularly on mobile), but it should never be the only save that happens.

Requirements:
- Progress is tied to the student's Telegram identity (§8.8) and stored in Supabase, not just in the browser, so it survives a cleared cache or signing in again on a different device.
- Returning to a topic left mid-lesson resumes from the last saved point rather than restarting from the first beat.

### 8.10 Failure handling
- If the model times out generating a response, the app reloads automatically rather than leaving the student staring at a stuck board.
- Automatic reload on timeout needs a cap — after a couple of automatic attempts, stop and tell the student plainly instead of looping silently, which is what would happen during a genuine outage rather than a one-off slow response.
- If the student loses their connection, the app tells them plainly that they're offline and need to reload to continue — no silent retries, no faked progress.
- If Telegram sign-in itself fails — the student declines the confirmation box, the popup is blocked, the `id_token` fails server-side validation (§8.8), or Telegram is unreachable — the app says so plainly and offers to retry, the same principle as the other failure cases above, rather than a silent redirect loop or a generic error.
- If AI-generated lesson content fails schema validation — even after a retry — the app shows a plain error and lets the student retry manually, rather than silently falling back to something simpler or looping automatically. Decided deliberately: automatic fallback risks quietly serving degraded content without the student (or anyone) noticing a problem occurred at all.
- Both cases are low-cost specifically because of incremental progress saving (§8.9): a reload picks the student back up at the last saved point instead of losing the lesson.

---

### 8.11 Level check
A placement step between signing in and the study plan (§7, detail TBD) — determines which level a student starts at, so the plan doesn't waste their time on material they've outgrown or skip past what they actually need. Uses the same six tiers already tagged across all 366 reference-material topics (§8.1), in order: A1 < A2 < B1 < B1+ < B2 < C1. Not strictly one-time — a student can retake it later to update their level (see Retaking, below).

- **Presentation: no new UI pattern.** Rendered on the board itself, reusing the same mechanism check-in questions already use (§8.4) — a fill-in-the-blank prompt on the board rather than a separate dedicated screen.
- **Pregenerated question bank**: 10 questions per level, 60 total, authored and reviewed once — same content-ownership model as the reference material and doodle library, not generated per student. Each question ties to a `topic_id` at that level (§8.1), keeping one single source of truth rather than a second, disconnected content set.
- **Format: fill in the blank, not multiple choice.** Decided specifically to avoid what multiple choice invites: a student landing on the right option by elimination or a lucky guess without actually having the knowledge, which would misplace them. Typing the answer requires active recall, not just recognition — a meaningfully stronger signal right at the boundary the test is trying to find.
- **Grading: a fast deterministic pass first, AI as the fallback — not AI on every answer.** Normalize the typed answer (lowercase, trim, strip punctuation, expand common contractions like "I've" → "I have") and check it against that question's predefined accepted-answer list. Only when nothing matches does it fall back to a Claude API call (Haiku tier is enough — a quick yes/no grammatical judgment, not a generation task) asking whether the answer is acceptable anyway — a valid alternate phrasing, or a typo that doesn't actually change the grammar being tested. Deterministic and cheap for the common case; AI reserved for the genuinely ambiguous residual.

**The adaptive algorithm:**
- **Opening round**: one question each from A1, B1, and C1 — a coarse low/mid/high read before narrowing in.
- **Evaluate in pairs, not single questions** — specifically to guard against a lucky pass on one question (a C1 guess that happens to land) being mistaken for real competence there:
  - 2 out of 2 correct at a level → step up one level, start a new pair there.
  - 0 out of 2 → step down one level, start a new pair there (unless already at A1 — see floor, below).
  - 1 out of 2 (mixed) → ask 2 more at the *same* level (4 total there), then re-evaluate the accumulated 4: a clear majority resolves up or down as above; a result still sitting in the 40–60% range is the early-stop signal, below.
  - Never repeat the same question twice within one student's attempt.
- **Floor and ceiling**: missing at A1 places the student at A1 directly — nothing lower to test — which is exactly what the skip option (below) exists to shortcut for an obvious beginner. Passing at C1 places them at C1, the top of what's offered (no C2 grammar content, §8.1).
- **Early stop**: once any level has 4 or more answered questions with accuracy in the 40–60% range, stop immediately and place there — no reason to burn the remaining budget once that signal is clear.
- **Hard cap**: 15 questions total. If the cap is reached without a level cleanly resolving, fall back to the same rule used at a clean finish, below, on whatever's been collected.
- **Final placement**: not a percentage target to hit exactly — walk up from the lowest level tested and place the student at the first level they have *not* clearly cleared (roughly 80%+ accuracy). A deterministic rule a stopping algorithm can check directly, rather than requiring an exact 40–50% hit that a 3-5 question sample may never land on precisely.
- **Skip option**: a plainly visible "I'm a complete beginner" control that places the student at A1 immediately, no test run.

**Retaking.** A student can retake the level check later to update their placement — extends the same seen-question tracking already built for lesson variants (progress records, §9.1): the student's record tracks which specific level-check questions they've already been shown, and picking a question for either a first attempt or a retake prefers one they haven't seen yet. **One real constraint worth being upfront about**: with only 10 questions per level, "never repeat" can't be an unlimited guarantee — a student who's already seen most of a level's pool (from a first attempt plus one or two retakes) will eventually exhaust the unseen ones, and the app falls back to allowing a repeat rather than blocking the retake entirely. This isn't a flaw so much as a direct consequence of a fixed, curated bank rather than something generated on demand — growing the pool later (more than 10 per level) is the lever if retake frequency in practice makes this bite sooner than expected.

Illustrative question schema:

```json
{
  "topic_id": "present_perfect_tense",
  "level": "B1",
  "prompt": "She ___ (visit) her grandmother three times this year.",
  "accepted_answers": ["has visited"]
}
```

### 8.12 Study plan
A fixed, ordered sequence of topics computed once after the level check (§8.11) places the student — not a topic browser, not a recommendation engine, and not the personalized/spaced-repetition system already deferred to Phase 2 (§6.2). The student is never asked which topic to study next; the app always just serves the next one in their path, the way Duolingo never asks either.

- **Ordering**, drawn from the 366 reference-material topics (§8.1):
  1. **Level order** — start at the tier the level check placed the student, walk upward through the remaining tiers (A1 < A2 < B1 < B1+ < B2 < C1), never revisiting a tier below their placement.
  2. **Family grouping within a level** — topics already cluster by grammatical family through their existing `topic_id` naming (`present_*`, `past_*`, `would_*`, `comparative_*`, and so on); walk one family at a time within a level rather than an arbitrary order.
  3. **A short, explicitly-authored list of cross-family "X before Y" pins** for the handful of orderings that would otherwise feel broken (comparatives before superlatives, and similar) — not a full dependency graph across all 366 topics.
- **Advancing the path reuses the mastery branching already in §8.4**, rather than a separate gate: an 80%+ quiz score marks the topic passed and moves the student to the next topic in their path — this is what resolves §8.4's previously open "the flow simply ends there" gap. Anything below 80% keeps the student on the current topic, following the re-teach behavior §8.4 already defines; the path doesn't advance until they clear it.
- **No dedicated path screen.** The main screen after sign-in is a lightweight **dashboard** — results and progress, not a browsable list of topics — with one control that goes straight to the board. All actual navigation happens through the board itself, in natural language, not through a screen the student has to read and choose from. This isn't a step back from having a path screen at all; a visible path was never meant to be tappable or browsable either (no topic browser is a longstanding non-goal, §6), so nothing that was actually interactive is being removed — only a screen that would have been read-only anyway. Deliberately minimal for v1 — a small set of grammar-only stats (e.g. topics completed out of the total at their level), not a fuller design. Revisiting it is tied to the speaking/listening/reading/writing expansion (§6.2): a fuller dashboard makes more sense once there's more than one skill's progress to show.
- **One prompt, reused three ways**, rather than three separate mechanisms: the board greets the student by name (from Telegram, §8.8) and asks whether to continue — rendered the same way a check-in question is (§8.4), not a new UI pattern. This single prompt covers:
  1. **Session start/resume** — tapping the dashboard's one control lands straight on the board with this prompt already asking about the student's current path topic, rather than a separate "you're back" screen.
  2. **Path-to-path transition** — after passing a topic's quiz (above), instead of returning to the dashboard, the board asks the same way whether to continue into the next topic immediately.
  3. **Returning from a detour** (below) — once an out-of-path topic wraps up, the same prompt offers to pick back up where the path was left.
  In every case, declining just leaves the student where they are, free to use the input normally — nothing is lost, since path position and topic mastery are both saved the moment they actually happen (§8.9), not only when the student agrees to keep going.
- **The greeting itself isn't identical every time — it depends on how recently the student was last active.** The first visit of a calendar day gets the fuller greeting described above. Any additional visit later that same day gets a short "Welcome back, [name]" instead, before the same continue-prompt — not the full greeting repeated. Requires tracking when a student was last greeted (§9.1), checked against the current date each time the prompt would fire. A simple day boundary (not full per-student timezone awareness) is a reasonable v1 simplification — a student active right around midnight might occasionally get treated as a "new day" a little early or late, which is low-stakes enough not to warrant solving precisely for v1.
- **Out-of-path requests stay available and don't derail the path.** Typing a topic or sending a photo (§8.1) still works mid-plan, for something the student wants explained that isn't next in their sequence — a question about school material, say. That lesson runs exactly like any other, quiz included, and is recorded as passed or not in the student's progress record (§8.9) the same way a path topic would be. When advancing the path later reaches a topic that's already marked passed this way, it's skipped silently — no re-teaching something the student has already covered, no separate tracking system needed beyond the progress records that already exist. The path's own position doesn't move because of a detour; only clearing the topic that's actually next in sequence advances it.

Illustrative schema:

```json
{
  "user_id": "<telegram id>",
  "ordered_topic_ids": ["present_simple_be", "present_simple", "...."],
  "current_position": 4
}
```

Requirements:
- The path is computed once, right after the level check completes or is skipped — advancing is moving a stored position forward by one, not recomputing a plan on every request.
- A level-check retake (§8.11) that produces a different placement terminates the current study plan outright and computes a fresh one at the new level — no splicing or merging with progress already made on the old path.
- No student-facing browsing or reordering control in v1, consistent with the single-input philosophy already applied everywhere else (§8.5, §11) — the dashboard shows progress, it doesn't let the student pick from it.
- Not the same feature as the deferred Phase 2 item in §6.2: that's about reordering or resurfacing content based on inferred forgetting or personalization over time; this is a fixed sequence with a pass/fail gate, built from data and logic that already exist.

### 8.13 Voice and persona
Everything specified so far — color coding, beat structure, pacing, the quiz — is about *what* the board shows. Nothing until now has said *how the AI talks*, and that gap is what makes a technically-correct lesson still feel like a form to fill out rather than a tutor. This section is that missing piece.

- **Identity**: the tutor is named **Bixy** — an invented character, not a real name borrowed from any one culture, matching Duolingo's own choice of "Duo" over a human name. Deliberately gender-ambiguous and easy to say across English, Uzbek, and Russian alike. Visual representation is still undecided (Fayzullo is considering it separately) — right now Bixy exists only as a voice; nothing in the doodle library (§9.1) represents Bixy the way it represents in-lesson story characters like Diana and Marcus.
- **First meeting**: rather than a separate ceremony before anything else happens, Bixy's introduction — greeting, name, a short line on what it can help with — is folded into the opening of the very first lesson itself, the first time a student ever reaches the board with something to actually teach. The level check (§8.11), when one runs, stays a plain, direct test with no introduction attached to it — simpler than treating "meet Bixy" as its own onboarding stage.
- **Get-to-know-you conversation**, right after that first introduction: a brief, skippable exchange asking about the student — hobbies, occupation, interests, where they study, why they're learning English — using the same input as everything else, not a form. Stored per student (§9.1) and used to personalize how Bixy talks to them going forward.
- **Personalization applies to Bixy's own dynamic wrapper layer — greetings, continue-prompts, transition moments — not the shared lesson content itself.** This is a deliberate scope decision, not an oversight: the story track, formal explanations, check-in reactions, and quiz are all designed to be generated once per topic and reused across every student who reaches it (§9.2) — that sharing is most of what keeps generation affordable. Folding personal details into that shared content would make it unique per student and break the caching model it depends on. The "greets the student by name" mechanic (§8.12) already establishes the right pattern: a small bit of text generated fresh per interaction, cheap because it's already dynamic, is where personal context belongs — not the expensive, cached part.
- **Framing**: a personal tutor, not a replacement for the student's classroom teacher — it exists to reinforce and clarify what they're already being taught elsewhere, not to be a new authority handing down rules from scratch.
- **Relationship**: deliberately neither a strict authority nor a fully equal peer — something in between. Knowledgeable and steady while explaining or correcting a mistake; casual and down-to-earth the rest of the time. Doesn't lecture, and doesn't fully defer either.
- **Energy adapts to the moment, rather than sitting at one fixed level** — upbeat and warm when a student passes a topic or gets something right; calmer and more focused while explaining a concept or walking through a mistake. Never forces enthusiasm into a moment that actually calls for patience, and never stays flatly cheerful regardless of what just happened.
- **This governs every piece of AI-generated text in a lesson**, not just one moment: story narration, formal explanations, check-in reactions, quiz transitions, and out-of-path detour lessons (§8.1) all come from the same voice.
- **Language register adapts the same way energy does** — genuinely casual and playful in lighter moments (celebrating a pass, a story aside), more measured and polished while actually explaining a rule or walking through a mistake. Not one fixed register held throughout the whole lesson.
- **Tone shifts for a genuine pattern of struggle, not a single hard topic.** One topic needing a full re-teach is normal and shouldn't change anything — that's just how learning works. If a student needs a full re-teach (below 50%, §8.4) on multiple topics in a row — two consecutive is a reasonable starting threshold, not yet validated — Bixy's tone becomes more deliberately patient and reassuring, without turning it into a big, serious moment.
- **If asked whether it's real, Bixy stays playful and in-character rather than launching into a formal disclosure — but doesn't actually claim to be human.** A light, deflecting first response is fine ("Ha, does it matter? Let's get back to..."); refined from the original instinct to just "deflect" outright, since a student sincerely asking (not joking around) deserves not to be told something false to keep the bit going. Worth being deliberate about this one specifically, not treating it as pure persona flavor — the audience likely includes minors self-studying without supervision, and pretending to be human if genuinely asked crosses from playful into actually misleading someone about what they're talking to.
- **Wrong-answer handling is the highest-priority piece of this**, and the most concrete: instead of a generic "incorrect, try again," the reaction should name what's actually going on with *that specific* wrong choice — see the schema addition below for how this stays implementable without a live model call per mistake.
- **Pacing shouldn't lock into a rigid mechanical alternation** between story and formal beats (§8.2) either — a real tutor doesn't ping-pong on a fixed rhythm; sometimes the story runs a while before the rule shows up, sometimes the rule lands fast and the lesson moves on. This is a generation-prompt instruction, not a schema change — the two-track structure stays, just not on a metronome.
- **Implementation**: none of this is a new architecture component — it's a persona specification folded into the same system prompt already producing board scripts (§9.1's Content generation component), the same way Claude itself is given a character rather than a bare instruction set. Concrete example pairs anchor a tone far better than adjectives alone do in practice:

| Situation | Flat | Persona-consistent |
|---|---|---|
| Wrong check-in answer | "Incorrect. The correct answer is 'have gone'." | "Ah, close — 'went' works for simple past, but since this is still connected to right now, we need..." |
| Explaining a tricky point (calmer energy) | "Present perfect connects the past to the present." | "This one takes a second to click, so let's slow down here — it's not really about *when* something happened, it's about whether it still matters right now." |
| Passing a topic (upbeat energy) | "Topic passed. 85%." | "You've got this one down — ready for what's next?" |

Requirements:
- Check-in questions (§8.4) get a `wrong_answer_reactions` field — one tailored response per incorrect option, generated alongside the question itself, not triggered live at the moment of a mistake. This stays fully within the existing caching model (§9.2): a check-in only ever has a small, fixed set of possible wrong answers, and all of them are already known at generation time, so there's no reason to wait for the mistake to happen before writing the reaction to it.
- Not a separate model or prompt from lesson generation — the persona lives in the same system prompt already producing board scripts, so it doesn't add a new pipeline or its own cost line.
- The example phrasing throughout this section is written in English for illustration — the actual generated narration (§8.7) should carry Bixy's tone idiomatically into whichever language is selected, not translate these specific English lines literally. "Ha, does it matter?" word-for-word in Uzbek or Russian may not land the way it does in English; the *character* is what's fixed, not the exact wording.

Illustrative schema addition to a check-in beat — matches the `formal_beat` / `check_in_question` shape settled in §8.2, not a separate structure:

```json
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
```

## 9. Technical architecture

### 9.1 High-level components
**Architecture style: a modular monolith, not microservices.** One Node.js backend, organized into clean internal modules (auth, content generation, TTS orchestration, progress/study-plan, level check) rather than a single tangled service — but still one deployed service, not several independently-deployed ones. Microservices solve problems this team doesn't have yet — independent scaling per component, multiple teams needing separate deploy cycles — and mainly add operational overhead (network calls where function calls used to be, multiple deployments, harder debugging) without buying anything real at this stage. Clean module boundaries now mean splitting a piece out later, if it's ever genuinely warranted, is a refactor rather than a rewrite.

- **Client:** React Native with Expo — used for the web app now, not only the native iOS/Android apps planned for later (§6.2). Chosen specifically because native mobile is a stated near-term goal: Expo's web target (`react-native-web`) is stable as of SDK 54, renders to real DOM/SVG in the browser, and realistically shares 60–80% of code with the eventual native apps — business logic, API calls, state, and hooks carry over directly; the presentation layer doesn't, and needs platform-specific work regardless of framework choice. The progressive stroke-drawing technique (hand-drawn-style strokes, stroke-offset "draw" animation) validated in the working prototype built during scoping applies directly to the web/`react-native-web` target, since that's still rendering to a real browser DOM — no native app shell needed for v1. It does **not** carry over to the native iOS/Android builds without separate work (React Native Skia or equivalent), which is why that rework is explicitly scoped to the mobile phase, not solved early (§6.2).
- **Doodle rendering:** built in-house from open-source, free client-side libraries — not a hosted third-party service (unlike VoiceLab, §9.1's TTS entry). Two separable techniques, and a key point Fayzullo raised worth stating explicitly: **neither one sits on the topic-generation critical path**, by construction — the board script only ever references a library element by ID plus position/attachment (§8.2), the LLM never generates or touches artwork, and rendering happens entirely client-side at playback time, independent of whichever request pipeline produced the script (freshly generated or served from §9.2's cache). So this was never a speed dependency the way LLM generation or TTS generation are; it's a separate, always-cheap step. (1) **Sketchy style** — Rough.js (MIT license, <9kB, actively maintained) renders lines, shapes, and SVG paths with natural hand-drawn wobble instead of vector-perfect geometry. Per Fayzullo's point: this should be baked once per library element, not recomputed on every playback — Rough.js's `seed` option makes its wobble deterministic, so each of the ~20 (and growing) elements gets run through Rough.js exactly once at asset-creation time, and the resulting sketchy path data is what actually gets stored as the doodle-library asset, not a "clean" source SVG. This also guarantees the same element looks identical everywhere it's reused, rather than re-randomizing per view. **Must be stored as SVG, not PNG** — a raster format has no path data to progressively reveal, so it would lose the draw-in animation entirely (see below) and force a fallback to a pre-rendered clip, which is exactly the Lottie-style approach already ruled out for being incompatible with dynamic AI-arranged scenes. (2) **Progressive draw-in** — the stroke-dasharray/stroke-dashoffset technique already validated in the working prototype (§14), applied to the pre-baked sketchy paths at playback time; needs no library at all, though GSAP's DrawSVGPlugin (free since April 2025, previously a paid Club GreenSock plugin) is a convenient wrapper for sequencing and staggering the reveal across several paths in one beat. This part genuinely can't be pre-baked the same way the shape can — it's a real-time reveal, not a static asset — but that's not a cost concern: animating a dashoffset is a trivial CSS interpolation, not a rendering or generation expense.

  **Now prototyped against the actual 20-element set, not just the one-off lesson — with one real finding worth recording.** Rough.js's typical demo settings (`roughness` around 1–1.5) assume relatively simple, sparse input geometry (a basic rectangle, a plain line). These doodle elements are hand-drawn freehand paths with thousands of bezier points already — feeding that through Rough.js at typical roughness produced a beaded, scalloped look, not a natural pencil wobble, because the jitter algorithm compounds with input that's already organic rather than smoothing it into something more human. The setting that actually worked, verified visually across simple elements (`face_happy`) and dense ones (`person_a`, `person_sitting`) alike: `roughness: 0.15, bowing: 0.3` — much gentler than Rough.js's own defaults suggest. `seed` is assigned per element as a fixed alphabetical index (`arrow` = 1, `book` = 2, and so on) — documented so it stays reproducible if the pipeline is ever re-run, rather than arbitrary and forgotten. All 20 elements are baked with these settings and marked `"complete"` in `doodle-library.json`.

  Asset-authoring requirements this implies for the 20-element set (and everything added after): each element must be drawn as **stroked line art** — visible outlines with a defined stroke, not flat color fills — since only a stroke has a meaningful dashoffset to animate; a flat-filled shape (e.g. a solid-color face) has nothing to progressively reveal the same way and would need a different technique (a simple fade-in after its outline draws, not stroke-dashoffset) if flat fills are used at all. **Draw order is not something Rough.js decides** — the library only handles the sketchy wobble styling; sequencing is a separate, manual authoring choice. The simplest way to encode it needs no extra metadata field at all: order the individual paths/lines *within* each source SVG in the sequence they should visibly draw (most design tools preserve layer/draw order on SVG export), and animate through them in that document order. One more thing worth knowing before this gets built: Rough.js typically renders one input shape as several overlapping strokes grouped together (that repetition *is* the hand-drawn texture) rather than a clean 1:1 path — so draw order should be authored at the level of each Rough.js-generated shape group (one logical stroke of the doodle), not by trying to choreograph the individual wobble-strokes inside a single group, which would be fighting the library rather than using it.
- **Backend (Node.js + Supabase):** hosts the endpoint that calls the model to generate board scripts from the curated reference material — for photo requests, a preceding step first identifies the topic from the image (§8.1) — and serves/caches the results.
- **Model provider: Claude API.** Recommended for reasons specific to this product: native image input (a photo of a blackboard or textbook page can be sent directly and analyzed to identify the topic, no separate OCR/vision pipeline needed), prompt caching (the mechanism behind §9.2's cost strategy), and reliable structured JSON output for the board-script schema. Use a tiered model strategy: Haiku 4.5 for routine, high-volume lesson generation; Sonnet 5 as the default for anything needing more nuance, including topic identification from a photo, which may need more careful reasoning than a typed topic name does; a top-tier model reserved only for cases that clearly justify the extra cost.
- **Reference material:** a curated, product-owned set of lean per-topic outlines (formula, key idea, a couple of examples, the common mistake — not full explanatory prose) covering English grammar, written and reviewed once, then supplied as grounding content on every lesson request — not regenerated per student. Stored as structured JSON in Supabase, one record per topic (§8.1) — authored directly rather than extracted from a document. `reference-material.json`'s top level is now an object with two arrays, `topics` and `level_check_questions` (§8.11, §9.1), not a flat list of topics as before — a breaking shape change worth flagging to anything already written against the old format.
- **Doodle library:** a separate, product-owned catalog of reusable doodle elements (`doodle-library.json`), each with an ID, category, and description — the visual assets themselves (pre-baked sketchy SVG path data plus draw-order metadata, per the Doodle rendering entry above) are created/curated by the product team in a consistent hand-drawn style, not generated by the model. The JSON file itself stays metadata only, matching its current shape — the actual SVG artwork for each element is a separate file per ID (e.g. `person_a.svg`), not inline SVG markup embedded in the JSON, which would be awkward to author and version. The content-generation LLM selects and arranges elements from this catalog by ID when building a lesson's story track (§8.2); it never generates freeform new artwork per lesson. Grows over time as new elements are added.
- **Content generation (LLM):** produces board scripts in the schema above, conditioned on the reference material — plus, for photo requests, a preceding topic-identification pass over the image (§8.1) — this is the core prompt-engineering surface of the product. Also carries the persona/voice specification (§8.13), so tone is consistent across every generated lesson rather than living in a separate system. Output is structured JSON, not prose.
- **Text-to-speech: VoiceLab** (`api.voicelab.uz`), chosen specifically for native-quality Uzbek output — confirmed supported alongside English and Russian on the same `Lison` model, so narration quality doesn't vary by switching providers per language. Output is mono 16-bit PCM WAV at 24kHz; billing is per Unicode character. Audio is generated and persisted per beat rather than per lesson — both for independent replay/swap (§8.4, §8.9) and because each request's `text` field is hard-capped at 1,000 UTF-8 bytes, so a full lesson's narration could not be sent as a single call even if per-beat caching weren't already the plan. Every request carries a unique `Idempotency-Key`; retrying with the same key and body is safe and returns the original audio rather than double-generating or double-billing on a timeout/retry. The raw WAV bytes from the generation response are saved directly into Supabase Storage at generation time — VoiceLab's own history endpoint only exposes a signed URL valid for about 10 minutes, so it is never treated as the source of truth for cached audio. Since narration language is student-selectable (§8.7), the integration needs one `voice_id` per supported language (English, Uzbek, Russian) rather than a single global voice — Fayzullo to provide the specific IDs once chosen from the VoiceLab dashboard. Mixed-language text within one request (an Uzbek narration correctly pronouncing an embedded English word or phrase) is confirmed working natively, no special tagging needed — validated by hands-on testing against VoiceLab's demo (§8.7). That same testing surfaced a slight Uzbek accent on pure-English output too, which only affects narration when English is the selected app language, not the (never-spoken) target-language content itself.
- **Auth:** Telegram Login (§8.8) — the client uses Telegram's Login library to get a signed `id_token`; the backend independently validates it against Telegram's public keys (issuer, audience, expiry) before trusting it, then keys progress records and variant-seen tracking off the Telegram user ID. Requires one Telegram bot, registered via @BotFather, to represent the app — the same bot would handle any future direct-messaging use, not a second one. Requested scope for v1: `profile` only (id, name, username, photo URL) — login, not messaging. `telegram:bot_access` and `phone` are both decided against for now; nothing in this PRD uses either.
- **Progress records:** Supabase rows tracking, per signed-in user, which topics have been started or passed, quiz scores, and the last-completed beat for any in-progress topic — written incrementally as the student moves through a lesson (§8.9), not only on exit. Also tracks, per user and per (topic, beat range), which stored explanation variants (§9.2) have already been shown, so a re-explanation request doesn't repeat one the student has already seen — and, on the same principle, which level-check questions (§8.11) a user has already been shown, so a retake avoids repeats where the pool allows it. Each user row also carries the name, username, and profile photo URL pulled from Telegram at login (§8.8) — refreshed on sign-in rather than assumed static, since a student can change any of these on Telegram's side. Also carries a small student profile from the get-to-know-you conversation (§8.13) — hobbies, occupation, interests, where they study, why they're learning — extracted from that conversation into structured fields rather than kept as a raw transcript, used only in Bixy's dynamic wrapper text (§8.13), not fed into the shared, cached lesson content. Also tracks the date the student was last greeted, so the continue-prompt (§8.12) can tell a first visit of the day from a repeat one.
- **Storage:** Supabase for cached board scripts and audio, the reference material, and session/progress records. Topic-identification photos (§8.1) are processed transiently and discarded immediately once the topic is identified — never persisted.
- **Level-check bank:** the 60 pregenerated fill-in-the-blank questions (§8.11) — drafted and live in `reference-material.json` itself, under a `level_check_questions` array alongside the existing `topics` array, rather than a separate file or table. Each question ties back to a `topic_id` from `topics`, so there's one source of truth, not two content sets to keep in sync. Grading is mostly a lookup against each question's accepted-answer list; the Claude API is only called as a fallback for answers that don't match anything on that list (§8.11) — a small, cheap, occasional call, not part of the main generation pipeline.
- **Study plan:** one Supabase row per user — an ordered list of `topic_id`s plus a current-position pointer (§8.12) — computed once from the level check's result and the ordering rules in §8.12, then just read and incremented as the student passes topics. Not regenerated per request.

### 9.2 Generation and caching strategy
Two different kinds of caching are in play here, and they solve different problems:

- **Result caching (Supabase):** if a lesson has already been generated before — same topic, same source, same language (§8.7) — serve a stored board script and audio directly, with no model call at all. This is what makes a repeat request effectively free. A given (topic, source, language) combination can have more than one stored result once variant pooling (below) is in play, so "already generated" means at least one matching result exists, not exactly one. Editing a topic's reference material invalidates any cached results for that `topic_id` — the next request regenerates from the corrected outline rather than continuing to serve a lesson built on the mistake.
- **Variant pooling (re-explanation requests):** a re-explanation doesn't automatically mean a fresh model call. Each (topic, beat range, source, language) combination accumulates its own pool of independently-generated explanation variants over time, contributed by different students' re-explanation requests across the whole app, not just one student's own history. When a student asks for a different explanation of the same beat(s):
  1. Check the pool of variants already stored for that (topic, beat range, source, language) key.
  2. If one exists that this student hasn't been shown yet (§9.1 Progress records), serve it directly — no model or TTS call, and faster than live generation since there's no generation latency to wait through.
  3. Only once every stored variant has already been shown to this student does the app generate a genuinely new one live, scoped to the relevant beat(s) as before, and add it to the pool for future re-explanation requests from any student.
  The pool starts shallow — often a single variant — and grows organically as real re-explanation requests come in; it doesn't need to be pre-seeded. Each live generation still happens because some student asked for it, but it now pays down the cost of every future re-explanation on that same beat, not just that one request.
- **Prompt caching (Claude API):** for the requests that do need a model call — a first-time topic, or a re-explanation that has exhausted its variant pool — the reference material is sent as a cached block rather than paid for at full price on every call. A cache read costs roughly a tenth of the normal input price, so grounding a lesson in the full reference document costs a small fraction of a cent per request once the cache is warm, not the full price of that document every time.
- Net effect: grounding every lesson is affordable — the recurring cost of the grounding material itself is the discounted cache-read price, not the full input price, and a large share of requests — first-time topics served from result cache, and re-explanations served from the variant pool — never call the model at all.

See §12 for how this changes the accuracy picture versus the earlier "review before launch" plan.

### 9.3 Why not generate video
This was evaluated and rejected as the primary approach. Video-generation pipelines (whether AI whiteboard-video products or code-rendered video like Manim) produce a fixed artifact: good for a one-off explainer, but incompatible with per-beat replay and re-explanation, which is the product's core differentiator. The structured-board-script approach costs more up-front engineering (a renderer, not just a video player) but is the only approach that supports the interaction model in §8.4, and it maps naturally onto a web canvas.

---

## 10. Non-functional requirements

| Requirement | Target |
|---|---|
| **Content accuracy** | The curated reference material is reviewed once, on creation and on update, rather than reviewing individual generated lessons (see §12); a photo request adds a topic-identification accuracy question worth its own testing pass |
| **Lesson load time** | Cached lessons should begin playing within ~1–2 seconds; first-time generations should show visible progress rather than a blank wait |
| **Re-explanation latency** | Follow-up answers should return and begin rendering within a few seconds |
| **Device support** | Modern desktop and mobile web browsers; layout should stay usable on a phone browser even though the reference design is desktop-width, given the target persona is phone-first (see §13) |
| **File handling** | Photo upload with a clear size/format limit; graceful, plain messaging when a photo is unreadable or doesn't clearly show a recognizable grammar topic |
| **Offline** | Not required for v1 |
| **Cost predictability** | Grounding content (the reference material) is sent via prompt caching, not at full price, on every model call; a photo request adds one small, one-off image-analysis call to identify the topic before generation begins — cost per lesson should still be tracked from day one |
| **Progress durability** | A lesson resumed after closing the tab picks up from the last incrementally-saved point, not from the start (§8.9) |
| **Auth security** | Identity comes from Telegram, not a custom credential store — the app's own responsibility is validating the `id_token` correctly server-side on every login (§8.8, §12), not storing or protecting a password |

---

## 11. UX principles

- **One board, one tool.** The screen is a giant, plain, mostly-empty board with a single input control anchored at the bottom — no sidebars, no toolbars, no topic menus for v1. This follows the layout direction from the Figma reference provided: a large open canvas with a compact, dark, pill-shaped input area sitting on top of it, rather than a conventional app chrome of headers and panels.
- **The input does everything.** Starting a topic, attaching a photo, and asking for something to be re-explained are all the same action: type or attach, in the one input. Resist adding a second control to handle any of these separately in v1 — that's explicitly deferred (§6.2).
- **Pacing over speed.** The board should feel like it's being drawn by someone, not rendered instantly. Resist the urge to make lessons load "faster" by skipping the progressive reveal — the reveal is the product.
- **Checked, not just told.** A lesson isn't a monologue — it pauses to ask, not just to breathe. Comprehension checks between chunks and a quiz at the end are what make this feel like tutoring rather than a video with buttons.
- **Sentence-level narration, not paragraph dumps.** Beats should be short enough that a follow-up question can target one specific part, not "explain half the lesson again."
- **Visual restraint.** Diagrams should use a small, consistent visual language (a timeline looks the same across every tense lesson) rather than novel illustration per topic — consistency helps comprehension more than variety here.

A working prototype demonstrating the core rendering mechanic (progressive board drawing synced to narration, with granular replay) was built during scoping for the present perfect tense. It was browser-based, which now lines up directly with the web-app MVP decision, and can serve as a technical north star during implementation — the minimalist board-plus-input layout is the piece still to be designed against the Figma reference.

---

## 12. Risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| The reference material went through an AI self-review that found and fixed real copyright exposure (copied example sentences, initially in A1-A2, then confirmed to also affect B1-C1) — full details in the version history above. The set grew to 366 topics (A1 through C1) across the drafting process | Resolved — Fayzullo has now personally reviewed the file and confirmed it's clean | No further action needed on this specific risk. The reference material has both passed AI-driven remediation and human review, satisfying the original mitigation strategy from this row |
| Topic identification from a photo could misidentify the topic, or fail on a genuinely messy real-world photo (glare, bad lighting, an unclear angle, faint handwriting) — a new risk introduced by the photo-request path (§8.1) that didn't exist for typed requests | Medium — a wrong or failed identification undermines exactly the use case (a confused student) this feature is meant to help | Say so plainly when the photo doesn't clearly match a reference-material topic, rather than guessing or silently generating something off-target; test specifically against messy, real-world-quality photos before launch, not just clean reference images |
| A photo of a physical blackboard, textbook, or notes may itself contain copyrighted material, even though it's only used transiently to identify the topic — a much narrower exposure than the earlier PDF-upload design, which used a whole document as ongoing grounding | Low — the photo isn't retained or used as grounding content; the lesson always comes from the product's own reviewed reference material, never the photo itself | Process photos transiently — identify the topic, then discard (§9.1, §13) — and never use a student's photo as grounding content for the actual lesson, only as a topic pointer |
| Hand-drawn animation reads as robotic rather than natural | Medium — undermines the core value proposition | Invest specifically in stroke rendering quality (hand-drawn line technique, natural pacing) as a first-class engineering task, not a polish pass |
| No existing product has solved this interaction model | Medium — genuine R&D risk, not just execution risk | Validate the core mechanic with a small working prototype before committing full engineering time (done — see §14); keep MVP scope narrow (one input, one subject) to de-risk before expanding |
| Cost of live generation at scale | Low–Medium | Two caching layers now handle this: result caching avoids repeat model calls entirely, and prompt caching makes the grounding material cheap even when a model call does happen (§9.2); rate-limit re-explanation requests per session as a backstop |
| Web MVP doesn't match a phone-first target persona | Medium | Keep the layout responsive enough to be usable on a phone browser even though it isn't a native app; native iOS and Android apps are already planned as a separate future initiative (§6.2), not contingent on this risk materializing |
| Bilingual narration adds complexity without clear payoff | Low–Medium | Treat as an open question to validate with early users rather than a committed v1 feature |
| Check-in or quiz questions are mistargeted (too easy, too hard, or test something the lesson didn't actually cover) | Medium | Generate questions from the reference material grounding the lesson, never independently (§8.4); review question quality alongside the reference material itself |
| Telegram is the only way to sign in — a student without a Telegram account has no other path into the app | Medium — a real exclusion, not hypothetical | Deliberate v1 bet, not an oversight: Telegram has very high penetration in Uzbekistan specifically, and the one-tap login (no password to create) is a meaningful conversion advantage for exactly the phone-first persona this targets (§4). Worth validating with real signup data rather than assuming; a fallback path is the natural response if this turns out wrong, not something to pre-build speculatively |
| Skipping or getting server-side validation of Telegram's `id_token` wrong (signature, issuer, audience, expiry — §8.8) would mean trusting whatever the client claims about who's signed in | High if it happens — a full authentication bypass, not a degraded experience | Standard code review is the agreed bar for MVP, not a dedicated security audit — but validate using an established, already-audited JWT/OIDC library rather than hand-rolled verification logic. This is specifically the kind of subtle bug (wrong algorithm accepted, a skipped audience check) a general code review is likely to miss, so leaning on a library that's already had that scrutiny gets most of a dedicated review's protection without its cost |
| The typed/photo detour path (§8.1) still assumes a student can either type a grammar term or has something physical to point a photo at — someone with neither has no way to ask about something extra | Low, now that this is optional rather than the primary way anything gets taught — the study plan (§8.12) already advances every student automatically, with no typing or terminology knowledge required for the core flow at all | Photo request (§8.1) already covers "saw something, don't know its name." What's left — nothing to type and nothing to photograph — only affects the optional detour path, not core progression, so it's a much lower priority than when this row was first written against the old, request-driven flow |
| The reference material has grown substantially (101 AI-drafted topics across A1 and A2, in reference-material.json) but hasn't been reviewed by a human yet — review, not drafting, was always the actual point of this risk's mitigation | Medium — volume is no longer the constraint; an unreviewed error propagating to every lesson still is | Do a review pass — even a sampled one — before wiring this batch into the live app; drafting further levels (B1+) can wait until this batch is validated |
| If the Admin-provided default reference content turns out to be an existing copyrighted textbook, using it as the product's standing, product-wide grounding source is a materially bigger copyright exposure than a one-off student photo used only to identify a topic and then discarded (§8.1) — that transient, non-grounding use carries much lower exposure than this row's scenario | High if it happens — this content serves every student, not one person's private study | The default content must be original (product-authored, even if drafted quickly with AI help) or explicitly openly-licensed — never an arbitrary commercial textbook used this way |
| The off-topic refusal could false-positive on a legitimate grammar question that isn't phrased like a topic name (e.g., "why do we say 'I've been living here' not 'I live here'?") | Medium — undermines the core value proposition exactly where it should shine, and easy to miss in casual testing since obviously-off-topic tests won't catch it | Test the refusal boundary specifically with awkwardly-phrased-but-valid grammar questions, not just clearly off-topic ones, before treating this behavior as done |
| Lessons could overcorrect from "too fast" (the original prototype complaint) to "too long" — a motivation beat, fuller explanations, multiple discovery examples, two check-ins, and a 10-15 question end-of-topic test add up, with no defined upper bound on total lesson time | Medium — risks trading one usability problem for its opposite | Time an actual full lesson end-to-end once built, rather than assuming "slower and richer" is automatically better — a self-study, likely mobile user may still want this done in a few minutes |
| There's no defined way to skip or escape a check-in the student can't or won't answer correctly, and the "one input" design doesn't obviously provide one | Medium — a stuck check-in could dead-end a session with no graceful way forward except abandoning the topic entirely | Decide explicitly whether check-ins allow skipping after a failed attempt or two, rather than leaving it to fall out of "pauses until answered" literally |
| The AI-grading fallback in the level check (§8.11) could misjudge a typed answer — marking a genuine mistake as acceptable, or rejecting a valid alternate phrasing the accepted-answers list didn't anticipate | Medium — a wrong grading call directly corrupts the signal an adaptive placement algorithm depends on, more so than a wrong grade would matter on an ordinary quiz | Spot-check AI-grading decisions against the accepted-answers list during content review, same as any other generated content; the deterministic first pass (§8.11) already keeps the AI call to the minority of answers, narrowing where this risk can actually bite |
| The study plan's ordering (§8.12) — level, then family, then a short pin list — is a heuristic derived from existing naming and a handful of manually-authored rules, not a curriculum expert's sequencing | Medium — every student's path runs through this; a genuinely awkward ordering isn't a one-off content bug, it's systemic | Spot-check a few generated paths end-to-end before launch, the same way any other generated content gets reviewed; expand the pin list if specific bad orderings turn up rather than pre-building a fuller dependency graph speculatively |
| The get-to-know-you conversation (§8.13) is a new personal-data collection point — hobbies, occupation, interests, study place, learning motivation — even though none of these categories are sensitive on their own | Low | Keep it skippable, store only structured fields actually used for personalization rather than a raw transcript, and don't expand what's asked for beyond what §8.13 actually uses it for |

---

## 13. Open questions

- Resolved: the student selects an app language (English, Uzbek, or Russian) at sign-in, but it only affects the story track's spoken narration — all written board content (formal text, bubble text, quiz wording) stays English regardless of selection (§8.7).
- Resolved: in-narration code-switching (§8.7) works natively — Fayzullo tested mixed Uzbek/English text directly against VoiceLab's demo and `Lison` handled it correctly with no special tagging required.
- Resolved: VoiceLab's slight Uzbek accent on English output is accepted as-is — VoiceLab is the committed provider regardless, so this isn't a decision point.
- Resolved: sign-in is Telegram Login (§8.8) — a real, distinct identity per student from day one, via the student's own existing Telegram account. Fully retires the earlier manually-provisioned-credential concern (§12); no per-tester setup needed for multi-account testing either, since any real Telegram account works.
- Resolved: the Telegram Login library, not OIDC (§8.8) — since Telegram is the only identity provider this app will ever use, not one of several, OIDC's genericness has no payoff here.
- Resolved: not requesting the `phone` scope — nothing in the app uses a phone number.
- Resolved: not requesting `telegram:bot_access` for v1 — scope stays login-only (`profile`), since no feature in this PRD messages students yet. Same bot either way if this changes later, just an added scope, not a second bot (§8.8).
- Mostly resolved by the study plan (§8.12): a student never needs to know grammar terminology to get taught anything, since the path picks every core topic automatically. What's left of this question only applies to the optional detour path (§8.1) — a student wanting to ask about something extra with no term to type and nothing to photograph still has no way in, but that's a much smaller gap than the original "empty board, nothing to type" concern this question was written against.
- Resolved: an uploaded topic-identification photo (§8.1) is discarded immediately once the topic is identified — no retention for debugging or any other purpose.
- Resolved, with a caveat worth stating plainly: Fayzullo owns the reference material and updates happen through Claude, driven conversationally rather than on a fixed cadence — matching how it's actually been built so far. Worth being direct about one part of this, though: Claude generating the content doesn't mean errors stop happening. The level-check bank is the concrete evidence sitting right in this same document — Claude's own first draft had two genuinely broken questions and six answer lists narrower than they should have been, all caught only because a review pass happened afterward. The practical version of "I own it" that actually holds up is Claude drafts and updates it, a review pass still happens before treating changes as final — not that authorship by Claude removes the need for one.
- Resolved: this was about how the *system* should behave once it exists, not anything already built — nothing has been built yet. Once live, §9.2's result caching means a topic gets generated once and served from storage after that; if a reference-material error is later fixed, a cached lesson generated from the old, wrong outline would otherwise keep being served unchanged. Sensible default: editing a topic's reference material invalidates any cached results for that `topic_id`, so the next request regenerates from the corrected version rather than continuing to serve stale content built on the mistake.
- Resolved: desktop is the primary target for the webapp, responsive as a standard secondary requirement, not elevated because of the phone-first persona (§4). Native iOS and Android apps are planned, but as a distinct future initiative separate from this webapp, not a v1 or near-term web responsiveness push.
- Resolved: the future content-management panel (§6.2) goes through Telegram login too, restricted to specific Telegram accounts — not a wholly separate auth mechanism from the student-facing sign-in.
- Resolved: the reference material now spans A1 through C1 (366 topics), and Fayzullo has personally reviewed the file and confirmed it's clean. Coverage and review are no longer open questions for v1 — the reference material is production-ready.
- Resolved: Fayzullo has personally reviewed all 60 level-check questions, on top of Claude's own earlier self-review pass. The level-check bank is production-ready.
- Resolved: level check (§8.11) reuses the check-in question rendering already on the board (§8.4) — no new UI pattern needed.
- Resolved: retakes are allowed (§8.11), tracked with the same seen-question mechanism as lesson variants (§9.1) — with the caveat that a 10-question-per-level pool can't guarantee "never repeat" indefinitely across enough retakes.
- Resolved: a level-check retake (§8.11) that produces a different placement terminates the student's current study plan (§8.12) and recomputes a new one from scratch at the new level — not a splice or a merge with what came before.
- Deliberately deferred, not forgotten: what happens when a student clears the last topic in their path (finishes C1). There's no content planned beyond C1 yet, so this is flagged rather than answered — revisit once that's decided.
- Resolved: the dashboard (§8.12) stays deliberately minimal for v1 — a small set of grammar-only stats, not a fuller design. Revisiting it is tied to the speaking/listening/reading/writing expansion (§6.2): a fuller dashboard makes more sense once there's more than one skill's progress to show.
- Bixy's visual representation (§8.13) is undecided — Fayzullo is considering it separately and will bring it back once there's a direction. Right now Bixy is voice-only, with no doodle-library presence of its own.
- Resolved: all 20 doodle-library elements are baked (§9.1) — Rough.js's typical demo roughness turned out too aggressive for these already-dense hand-drawn paths, producing a beaded look rather than a natural wobble; `roughness: 0.15, bowing: 0.3` is what actually worked, verified visually across both simple and dense elements. `doodle-library.json` now marks each `"complete"`.
- Resolved: the stroke-dashoffset draw-in technique (§9.1) is confirmed working against the actual baked assets, not just in theory — a standalone demo animated `person_a`, `clock`, and `speech_bubble` from the real downloaded files, including two elements drawing simultaneously in one beat and a working replay control. One real tuning question it surfaced: with a fixed per-path stroke duration, an element with more paths (`clock`, 16) visibly takes longer to finish than one with fewer (`person_a`, 11), regardless of whether it actually reads as more complex. Not a defect — a genuine open choice for whoever builds this for real: normalize total draw time per element, or let it keep scaling with path count.
- Resolved: Bixy introduces itself at the start of the first lesson, not as a separate ceremony before the level check — greeting, name, what it can help with, then a skippable get-to-know-you conversation (§8.13, §7). Simplified from an earlier draft that put this before the level check, on the reasoning that it added an extra onboarding stage for no real benefit.
- Confirm the personalization scope in §8.13 is what was actually meant: Claude scoped it to Bixy's dynamic wrapper text (greetings, continue-prompts) to protect the shared lesson-caching model, not the lesson content itself. If the intent was for lesson content to actually adapt per student, that's a materially bigger change — it would mean giving up most of §9.2's caching efficiency, not a small addition to it.
- Resolved: §7's core user flow now reflects the full settled path — sign-in, level check, study plan, the dashboard, and the on-board continue-prompt that handles "go to class" — rewritten end to end in §8.12's update rather than left stale.
- Monetization model (free, subscription, one-time) is deliberately deferred until after the speaking, listening, reading, and writing expansion (§6.2) — not just out of scope for this document, but explicitly not being discussed until the fuller product exists.
- The voice and persona spec (§8.13) is a written brief, not a tested one — a persona that reads well as a document doesn't automatically produce consistent, natural-sounding output from the model across many different topics and all three narration languages. Worth a real pass with actual generated lessons before treating the tone as settled, the same way the board's visual style needed the working prototype (§14) before it was trusted.

---

## 14. Validation to date

During scoping, the core rendering mechanic was validated with a working interactive prototype: a whiteboard lesson on the present perfect tense that progressively draws text and a timeline diagram, narrates each part with synchronized audio, and lets the user tap any section to have it redrawn and re-narrated independently. This confirmed the central technical bet — that structured, code-rendered board content (rather than generated video) can deliver the "AI draws on a whiteboard" experience while remaining genuinely interactive.

---

## 15. Glossary

- **Beat** — a single drawable/writable/narrated unit within a lesson (e.g., one sentence, one diagram).
- **Check-in** — a real test question, not a self-report, positioned at one of two fixed points in the lesson arc (§8.2, §8.4) that pauses the lesson until the student answers, keeping the lesson interactive rather than a straight narration.
- **Discovery** — the story-track phase of a lesson (2-4 beats, scaling with topic complexity) where the target grammar appears in context before the rule is ever stated — the inductive half of the lesson arc (§8.2).
- **Recap** — the point right after discovery where the same sentences get written on the board, with the grammar marker highlighted, rather than only spoken — the one exception to the story track never being written as text (§8.2).
- **Assessment quiz** — the 10–15 question, blended-format (multiple choice, true/false, fill-in-the-blank) graded test given at the end of a topic, used to decide whether the student passes, needs specific parts re-taught, or repeats the topic.
- **Progress record** — the saved state of a student's session: which topics are started or passed, quiz scores, and the last-completed point in any in-progress lesson.
- **Telegram Login** — the app's sole sign-in method: one-tap authentication via the student's existing Telegram account, requiring a Telegram bot to represent the app (§8.8). Returns name, username, and a profile photo URL — not a birthday, which Telegram's login data doesn't include.
- **Board script** — the structured JSON document describing an entire lesson as an ordered sequence of beats.
- **Photo request** — an alternative to typing: attaching a photo of a blackboard, textbook page, or notes to ask about a topic without knowing its name. Identifies which reference-material topic to teach; it isn't itself the lesson's grounding content (§8.1).
- **Reference-grounded lesson** — a lesson generated from the product's own curated reference material — the only kind of lesson now that the PDF-upload path has been removed. Replaces the earlier "knowledge-based lesson" idea, which relied on the model's unguided memory.
- **Reference material** — the curated, product-owned lean outlines (formula, key idea, examples, common mistake per topic — not full prose) that ground every lesson, stored as structured JSON in Supabase since it's authored directly; the AI generates the full lesson from these live, not by reading them aloud.
- **Prompt caching** — a Claude API feature that stores a processed version of repeated content (like the reference material) so later requests reuse it at a fraction of normal input cost, instead of paying full price each time.
- **Result caching** — the app's own storage (in Supabase) of already-generated board scripts and audio, so an identical repeat request is served with no model call at all.
- **Variant** — one of possibly several independently-generated explanations stored for the same topic, beat range, source, and language — used to give a student who asks for a re-explanation something genuinely different from what they already saw, drawn from storage rather than always generated fresh.
- **Live generation** — an on-demand model call made at request time — either a first-time lesson or a re-explanation — as opposed to serving a result-cached lesson.
