# Bixy PRD — Part 4: Quiz & Flow Control

> Covers original PRD §6, §13. Read `00-context-shipped-v1.md` first.
> §13 references the variant-pooling feature from v1 context and the persona
> tone-shift signal from Part 05 §8.

---

### 6. Topic-fail retry flow

**What changed (v14.5, confirmed against codebase v14.21):** Replaces the instant auto-restart on a failing
topic-test score with an explicit, acknowledged retry flow. The existing
score-tier thresholds are unchanged — **correction:** this doc previously
said "below 50% … 60–70% … 80%+," leaving 50–60% and 70–80% unspecified as
loose shorthand. The actual shipped code (`mastery.ts`, unit-tested) covers
the full range with no gaps: below 50% = re-teach the whole topic, 50–79% =
re-teach only missed parts, 80%+ = advance. Code is authoritative here —
recorded precisely so nobody later "fixes" the code to match the doc's
imprecise gaps.

- On any failing tier, Bixy announces the score in its own words, in-persona
  (illustrative only, not a fixed script — e.g. something like "Oh, you got
  67% — that's not quite enough, let's go over this topic again") and shows
  a **"Let's start"** confirm button; re-teaching (whole topic or missed parts,
  per the existing tier the score fell into) only begins once the student
  confirms. **Confirmed: pre-generated, not a live model call** — a handful
  of variant phrasings pre-generated into the board script, same pattern as
  `quiz_intro` (Part 02 §5). Satisfies "in its own words, not a fixed
  script" without a runtime model round-trip at the exact moment a student
  has just failed — avoids adding latency and a new failure mode there.
- After re-teaching finishes, the student does **not** retake the full
  10–15 question test. Instead they get a **fixed 8-question retest**:
  - Questions the student got wrong on the previous attempt are included
    first. **Confirmed: persisted server-side on progress**, not held in
    client state — a retest has to survive a full re-teach cycle, which can
    span a session boundary (student closes the app and returns later), so
    client-only state can't satisfy this regardless of preference. New
    persisted field, not previously stored (progress previously persisted
    only an aggregate `quiz_score` number).
  - If fewer than 8 were wrong, the remainder is filled from that topic's
    **stored variant pool** (same pooling mechanism used for re-explanation
    variants) — not freshly generated at retest time. **Pool scope,
    clarified during build:** the pool is shared per topic+language across
    all students, not per-student — every lesson generation and every
    re-explanation for a given topic contributes to that topic's one shared
    pool, harvested best-effort as a side effect of work already happening,
    nothing generated purely to stock it.
  - **Cold-start fallback, confirmed (a rule the original spec didn't
    state):** the very first time any student fails a given topic, the
    pool may hold only that lesson's own quiz content, or nothing at all.
    Fill order when this happens: missed questions first, then the pool,
    then — only if still short of 8 — questions the student answered
    *correctly* on that same attempt. Still never generates fresh content,
    consistent with the rule above. This is a transient cold-start specific
    to a topic's first-ever failure platform-wide (the pool being shared
    means it fills in over time from other students), not a standing gap —
    and reusing a correctly-answered question isn't free credit, the
    student still has to answer it right again.
  - If more than 8 were wrong, only 8 of the wrong ones are used for this
    retest round; no new questions are added that round.
- **Second miss:** if the 8-question retest also scores below 80%, the next
  round always re-teaches the **entire topic** regardless of the retest
  score or which tier it would otherwise have landed in, then the same
  8-question retest cycle repeats. **Confirmed (a rule the original spec
  didn't state): the escalation counter resets to 0 on a pass.** Without
  this, a student who passes a topic and later fails it again months later
  — on unrelated review, nothing to do with the original retry cycle —
  would get jumped straight to a whole-topic re-teach on their very first
  miss, since the counter would still be carrying state from a long-since
  resolved struggle. The counter tracks consecutive misses within one
  retry cycle, not lifetime failure count on a topic.

**Foundational dependency, confirmed missing and now being built here:**
this section (and §13 below) both describe the variant pool as an existing
mechanism to reuse. It isn't — `pickReTeachVariant` is a one-line
pass-through stub with no storage or retrieval behind it at all, despite
being listed as shipped in Part 00 (now corrected there). Building it
properly as real Part 04 infrastructure — storage, retrieval, dedup — since
two independent features here depend on it as such; filling retests from a
cheaper source instead would mean either reopening the
already-settled "retest pulls from a pool, not fresh generation" decision,
or building a throwaway stand-in §13 would then have to duplicate. **Built
and confirmed (v14.21):** content-addressed via a fingerprint hash over
semantic content only — excludes beat ids, quiz_question_id, and audio_url,
since those change on every regeneration while the underlying variant
doesn't, and answer-option order is treated as part of identity while the
accepted-answer set isn't. This fingerprint is also the persistence key for
missed-question tracking above, chosen specifically because positional ids
don't survive a regeneration (which `rule_version` bumps guarantee will
happen) while content fingerprints do.

### 13. Detour resume fix

**What changed (v14.13, corrected against codebase v14.21):** Fixes a bug
found via testing — when a student interrupts the current topic to ask
about a different (detour) topic mid-lesson, the interrupted topic doesn't
reliably get finished. **Correction:** the original framing ("never
resumes afterward, leaving it permanently incomplete") overstated the gap —
the actual resume machinery already exists and works: the interrupted
topic's beat position is persisted, a manual "Back to your plan" control
already returns and resumes correctly from that exact point. What's
actually missing is narrower:

- **No automatic return** — returning is currently a manual button tap;
  nothing detects that a detour has wrapped up. This is almost certainly
  the real behavior behind the original bug report — a student not
  noticing or tapping the button produces exactly "the topic never
  finishes," even though the resume mechanism underneath works fine.
- **No wrap-up check-in** before returning.
- Wrap-up check-in's wrong-answer retry depends on the variant pool (see
  §6 above) — didn't exist, being built now.

**Confirmed: auto-return after the wrap-up check-in**, not manual-only.
Relying on a manual tap for the normal case reintroduces the same failure
mode this section exists to fix — a control the student can simply not
notice. The existing manual "Back to your plan" button stays available as
a fallback/escape hatch, but isn't required for the normal path anymore.

- **Detour wrap-up:** once Bixy finishes explaining the requested detour
  topic, it asks a check-in question (same style as the check-ins already
  used within normal lesson flow), then **automatically returns** to the
  interrupted topic and resumes from the exact persisted beat position —
  this gives an explicit "we're done with your question" moment without
  requiring the student to remember to tap anything.
  - Wrong answer: retries with a new variant, same mechanism as any other
    check-in (the variant pool being built in §6 above) — not a separate
    retry system.
- **Does not change detour "passed" tracking — confirmed already correct
  as-is:** this check-in is a wrap-up step only, not a completion gate. The
  detour topic's "passed" status — the one that makes the study plan skip
  it later (Part 05 §8, detour topic tracking) — still requires that
  topic's own full quiz at ≥80%, unchanged. Verified in code: a detour pass
  is explicitly blocked from advancing the plan, so a detour stays
  "started" until its own full test separately passes.
