# Phase 7 — Study plan & dashboard

Depends on phase 6 (needs a placement to build a plan from) and phase 5
(needs mastery results to advance on).

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

