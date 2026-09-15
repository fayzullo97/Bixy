# Bixy PRD — Part 5: Persona & Greeting

> Covers original PRD §7, §8. Read `00-context-shipped-v1.md` first. §8's
> tone-shift signal/counter is reused by Part 06 (Angry-Morph trigger).

---

### 7. First-meeting sequence (the actual gap — day-boundary greeting already shipped)

**What changed (v14.6, scope corrected v14.22):** This section originally
assumed the entire greeting mechanism — both the day-boundary full/short
greeting and the one-time first-meeting sequence — had never shipped.
**Correction, confirmed via code trace:** that was too broad. The
day-boundary greeting (full greeting once per day, short "welcome back" on
later same-day visits) already shipped in v1 and is live — see Part 00,
now corrected there too. The actual gap was narrower: only the **first-ever
meeting sequence** (introduction + get-to-know-you conversation) was
missing, and that's what this section actually builds.

- **First-ever meeting** (brand-new student): happens at the start of the
  student's first lesson, not a separate pre-level-check stage — Bixy
  introduces itself (name, capability), followed by a skippable
  get-to-know-you conversation (hobbies, occupation, interests, study place,
  learning motivation), stored per student. The level check still runs
  immediately after sign-in with no separate ceremony.
- **Confirmed implementation detail:** finishing or skipping the
  get-to-know-you conversation stamps a `met_at` timestamp, so a decline
  never recurs (the student isn't re-asked on their next visit). The
  first-meeting flow deliberately does **not** stamp `last_greeted_at` (the
  day-boundary greeting's own tracking field) — otherwise Bixy would say
  "welcome back" seconds after "nice to meet you," which reads as broken
  even though both systems are technically working correctly.
- **Confirmed scope of the stored profile — narrower than "personalize how
  Bixy talks to them going forward" reads in isolation:** the profile does
  **not** feed cached lesson generation. Doing so would mean no two
  students' generation cache keys ever match, eliminating the shared cache
  (per topic+language) on the single most expensive call in the product —
  not a smaller version of personalization, a different and far costlier
  architecture. Instead, the profile colors only surfaces that are already
  per-request and uncached: re-explanations, identity deflection (§8
  below), and patient re-teaches (which already bypass the cache for the
  tone-shift reason described in §8). This is personalizing in the places
  it's actually free, not a reduced version of the original intent.

**(Day-boundary greeting, for reference — already shipped, not rebuilt
here):**
- Returning student, first visit of a calendar day: a full greeting.
- Returning student, later same-day visit: a short "welcome back [name]".

### 8. Persona/behavior gaps found via code audit

**What changed (v14.7):** Prompted by the missed-greeting discovery, a
code audit checked four more "Shipped in v1" claims against the actual
codebase rather than just the design doc. Two were confirmed accurate; two
are real gaps of the same kind — designed, documented as shipped, never
actually wired.

**Persona tone shift (struggle-driven patience)**
- Trigger: two consecutive full re-teaches (below 50%) on the same topic
- Scope: resets per topic — a struggle streak doesn't carry from one topic
  into the next; starting a new topic starts a fresh count
- Root cause: the persona prompt was designed to live entirely in one
  cached, byte-identical system-prompt block, which structurally cannot vary
  per-student — needs a persisted per-student, per-topic re-teach counter
  fed into a per-request (uncached) prompt fragment instead
- **Confirmed and built (v14.22):** `progress.reteach_all_streak` counts
  consecutive sub-50% tests per topic, derived server-side from the
  reported score, cleared on a pass. The persona fragment rides the
  uncached per-request user message — the system prompt block stays
  byte-identical and shared, which is the actual root cause above,
  confirmed in code. **A patient re-teach bypasses the shared lesson cache
  entirely** (both read and write) — patient-toned content is
  student-specific, so it can't be served from or written to the generic
  topic+language cache without leaking one student's struggle-driven tone
  into another student's lesson. This only applies to the rare patient-mode
  case (two consecutive sub-50% results), not normal generation.
- **Counted on the SCORE, not on the re-teach the board ran — recorded
  precisely, in the spirit of §6's threshold correction.** "Two consecutive
  full re-teaches" is defined by the parenthetical "(below 50%)", not by the
  `reteach_all` outcome: §6's second-miss rule ALSO forces a whole-topic
  re-teach at 50–79%, and those aren't this struggle pattern. Counting
  outcomes instead of scores would shift the tone on a student who scored
  in the 70s twice, which is the "one hard topic" case the trigger
  explicitly excludes. Code is authoritative (`nextReteachStreak`).
- **Profile answers are student-written free text** going into an
  instruction block, so each is trimmed, length-capped, and flattened to a
  single line before it reaches a prompt; blank answers are dropped rather
  than stored empty.

**In-character identity deflection**
- Add an explicit identity-question detection step early in the ask()
  pipeline, before topic-matching or the no-lesson-open fallback, so it
  fires regardless of whether a lesson is currently open
- Detection: a lightweight classification step, not simple keyword/pattern
  matching, so paraphrased questions ("are you a bot", "am I talking to a
  person") are also caught — accepting the added latency/cost per message
  as the tradeoff
- Routes to the existing deflection instruction, which was already speced
  but previously unreachable by any real input path
- **Confirmed and built (v14.22):** classified and answered before
  topic-matching, as speced. Fails open — if the classifier itself errors,
  the message falls through to normal topic-matching rather than blocking
  the request, so a classification failure degrades to "treated as an
  ordinary question" rather than breaking the conversation. Reply is
  generated per-request with a written per-language fallback if generation
  itself fails.

**Verified accurate, no changes needed:**
- Level-check early-stop logic — confirmed matches spec exactly (pairs of
  2, 40–60%-over-4 early stop, 15-question hard cap)
- Detour topic tracking — confirmed both the recording and checking sides
  exist and are correctly wired via the shared progress table (skip
  triggers on passing the detour, not merely requesting it, matching spec)
