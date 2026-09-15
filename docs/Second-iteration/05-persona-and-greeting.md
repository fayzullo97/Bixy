# Bixy PRD — Part 5: Persona & Greeting

> Covers original PRD §7, §8. Read `00-context-shipped-v1.md` first. §8's
> tone-shift signal/counter is reused by Part 06 (Angry-Morph trigger).

---

### 7. Session greeting mechanism (carried over from v1 — never shipped)

**What changed (v14.6):** This mechanism was fully designed during v1 but was
never actually implemented in production — nothing about the design itself
has changed, it's simply carried forward into iteration 2 to get built.

- **First-ever meeting** (brand-new student): happens at the start of the
  student's first lesson, not a separate pre-level-check stage — Bixy
  introduces itself (name, capability), followed by a skippable
  get-to-know-you conversation (hobbies, occupation, interests, study place,
  learning motivation), stored per student to personalize how Bixy talks to
  them going forward. The level check still runs immediately after sign-in
  with no separate ceremony.
- **Returning student, first visit of a calendar day:** a full greeting.
- **Returning student, later same-day visit:** a short "welcome back
  [name]".
- Requires tracking when the student was last greeted, per student.

**Note:** the "Shipped in v1" section's Persona bullet originally claimed
this greeting behavior was already live, which was inaccurate — that line
has since been corrected to reflect it was never implemented, with a
pointer to this section.

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

**Verified accurate, no changes needed:**
- Level-check early-stop logic — confirmed matches spec exactly (pairs of
  2, 40–60%-over-4 early stop, 15-question hard cap)
- Detour topic tracking — confirmed both the recording and checking sides
  exist and are correctly wired via the shared progress table (skip
  triggers on passing the detour, not merely requesting it, matching spec)
