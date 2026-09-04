# Phase 5 — Pacing, check-ins & assessment

Layers on top of phases 3 and 4 — needs both board rendering and real
generated content to build and test against.

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

