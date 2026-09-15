# Phase 6 — Level check

Reasonably self-contained. Shares the check-in rendering pattern from
phase 3.

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

