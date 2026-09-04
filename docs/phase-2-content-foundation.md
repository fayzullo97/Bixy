# Phase 2 — Content foundation: reference material & doodle library

Static, product-owned data that everything downstream (lessons, level
check, study plan) is grounded in or draws visuals from. This is data
ingestion, not generation — reference-material.json and doodle-library.json
already exist and are final; the baked doodle SVGs already exist too.

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

