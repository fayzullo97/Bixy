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

---

## Build notes (Iteration 2, Part 05)

**Correction to §7 — the greeting was PARTLY shipped.** §7 says the mechanism
"was never actually implemented in production." That's true of the first-ever
meeting and false of the rest: the day-boundary logic shipped in v1 and is
live — `greetingVariant` in `study-plan/greeting.ts`, `users.last_greeted_at`
(migration 0005), `POST /me/greeting`, and the board fetching it on arrival.
Returning students already get a full greeting on their first visit of a day
and a short "welcome back" after. Part 00's Persona bullet ("no recency-based
logic actually shipped") repeats the same overstatement; flagged here rather
than edited there, per Part 00's own rule. Only the first meeting was actually
missing, and that's what this part built.

**Confirmed during implementation:**

- **Where the meeting fires:** on arrival at the board, ahead of the
  continue-prompt, for a student Bixy has never met. That is "the start of
  their first lesson" as §7 means it — after placement, before any teaching —
  without inserting a stage before the level check.
- **A skip is remembered, not re-asked.** Finishing and skipping both stamp
  `met_at`. A skip that left it unset would re-open the conversation on every
  visit, which turns one declined question into a recurring one.
- **The meeting is not a greeting.** It deliberately does not stamp
  `last_greeted_at`: the student returns to the board seconds later, and a
  stamp would make that arrival a same-day repeat — Bixy following "nice to
  meet you" with "welcome back."
- **Answers are free text**, stored whole and never parsed; blank answers are
  dropped rather than stored empty, and each is length-capped and flattened to
  a single line before it reaches a prompt (it's student-written text going
  into an instruction block).
- **The tone-shift counter counts the SCORE, not the re-teach.** §6's
  second-miss rule also forces a whole-topic re-teach at 50–79%, and those
  aren't the "below 50%" struggle §8 defines the trigger against. It's derived
  server-side from the reported score and reset on a pass — a client can't ask
  for the patient register on its own behalf.
- **The student profile does NOT personalize cached lesson generation.** A
  lesson is cached per topic/source/language with no student in the key, so
  feeding every student's profile into it would take the whole product off the
  cache permanently, for flavour, on its most expensive call. Patience is the
  one thing that pulls a lesson out of the cache (that generation is written
  for one student, and must not be served to anyone else — nor may the row
  that already failed to land be served back to them), and the profile rides
  along once it has. Otherwise the profile colours the surfaces that are
  already per-request and uncached: re-explanations and the identity
  deflection. This is narrower than "personalize how Bixy talks to them going
  forward" reads in isolation, and it's the reading that doesn't cost the
  cache.
- **Identity detection runs on every typed message, strictly first**, and
  fails open — a classifier error means "not an identity question", so a blip
  costs a deflection rather than blocking a lesson request. The deflection line
  is generated (so it varies and stays in voice) with a written per-language
  fallback, because the one outcome that must never happen here is falling
  through to "I don't have information about that."

**Not yet applied to the live database:** migration `0009_persona.sql` —
`users.met_at`, `users.student_profile`, `progress.reteach_all_streak`. Until
it's pasted into the Supabase SQL editor, the greeting route errors on the
missing columns.
