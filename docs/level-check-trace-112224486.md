# Level-check trace — telegram_id 112224486

Investigated 2026-09-16. **Read-only**: only SELECTs against the production
Supabase REST API (`https://wgwmtycezhulyqzenqvm.supabase.co`). No writes, no
`reset-student` run. Raw query output: `level-check-trace-112224486.raw.json`.

## TL;DR

The run was 7 questions, placed at **C1**, and the terminating rule was **NOT**
the ambiguous-band early stop and **NOT** the hard cap. It was one of the two
C1-terminating branches in `decideNext`, and the database cannot tell them apart
because both produce C1:

- `RULE: ceiling` — 2/2 correct on the C1 pair (`focus === 'C1'` under signal `up`), or
- `RULE: boundary (down-branch)` — 0/2 on the C1 pair, `failed.add('C1')`,
  `next = B2`, `cleared.has('B2')` is true → `return { kind: 'place', level: focus }`
  where `focus` is **C1**, the level just failed 0/2.

So a student who got **both C1 questions wrong** is placed at C1 exactly like a
student who got both right. See "The undetermined step" below — this is the
thing worth looking at.

## What is actually persisted (and what is not)

Per-question correctness is **never stored**. The adaptive algorithm runs
client-side (`app/src/board/levelCheck.ts`, pure module); the answer history
lives only in `answeredRef` in `app/src/board/LevelCheckBoard.tsx` and dies with
the component. The server persists only:

- `level_check_seen` — `(telegram_id, question_id, seen_at)`. Written by
  `POST /level-check/seen` from `onSeen(picked.id)` at the moment a question is
  **rendered**, i.e. *before* it is answered.
- `level_placements` — one row, the final level, overwritten per attempt.

`POST /assessment/grade` (`server/src/modules/assessment/assessment.routes.ts`)
is stateless — it grades and returns, writing nothing. No correctness column
exists in any migration (0001–0009). No localStorage/sessionStorage either.

Therefore the per-step right/wrong below is **reconstructed by replaying the
deterministic `decideNext` against the observed tier order**, not read from a
table.

## Raw session data

Account: Fayzullo / @dev, `app_language=en`, `created_at` 2026-09-05.
All 7 `level_check_seen` rows fall in one 2m10s window and there is exactly one
`level_placements` row written 14s after the last question — a single attempt,
no prior session to separate out.

| # | seen_at (UTC) | Δ prev | tier | question_id |
|---|---------------|--------|------|-------------|
| 1 | 16:32:47.747 | — | A1 | `adverbs_of_frequency` |
| 2 | 16:33:25.220 | 37.5s | B1 | `a_an_meaning_per` |
| 3 | 16:33:31.208 | 6.0s | C1 | `ed_participle_clauses` |
| 4 | 16:34:02.823 | 31.6s | B2 | `each_others_one_anothers` |
| 5 | 16:34:21.743 | 18.9s | B2 | `generic_one_you_we` |
| 6 | 16:34:28.439 | 6.7s | C1 | `having_past_participle_clauses` |
| 7 | 16:34:57.565 | 29.1s | C1 | `ing_participle_clauses` |

Placement row: `C1`, `updated_at` 2026-09-16 16:35:11.854 (+14.3s after #7).

Because `seen_at` is stamped at render, Δ on row *n+1* is the time spent
answering question *n*. So: q1 ~37s, q2 ~6s, q3 ~32s, q4 ~19s, q5 ~7s, q6 ~29s,
q7 ~14s.

## Reconstruction

Observed tier sequence: `A1, B1, C1, B2, B2, C1, C1` → place `C1`.

Brute-forcing all 2^7 right/wrong patterns through the real `decideNext` leaves
exactly **4** consistent with that ask order and that final placement, which
collapse to 2 real branches (step 1 is free in both):

```
1.A1:WRONG  2.B1:RIGHT  3.C1:WRONG  4.B2:RIGHT  5.B2:RIGHT  6.C1:WRONG  7.C1:WRONG
1.A1:RIGHT  2.B1:RIGHT  3.C1:WRONG  4.B2:RIGHT  5.B2:RIGHT  6.C1:WRONG  7.C1:WRONG
1.A1:WRONG  2.B1:RIGHT  3.C1:WRONG  4.B2:RIGHT  5.B2:RIGHT  6.C1:RIGHT  7.C1:RIGHT
1.A1:RIGHT  2.B1:RIGHT  3.C1:WRONG  4.B2:RIGHT  5.B2:RIGHT  6.C1:RIGHT  7.C1:RIGHT
```

Step by step:

1. **A1** (`adverbs_of_frequency`) — opening read 1 of 3. **Undetermined.**
   `seedFocus` short-circuits on `b1.correct` before it ever reads `a1`, so the
   A1 answer had zero effect on this run.
2. **B1** (`a_an_meaning_per`) — **RIGHT** (forced). Answered in ~6s.
3. **C1** (`ed_participle_clauses`) — **WRONG** (forced). `c1.correct` false +
   `b1.correct` true → `seedFocus` returns **B2**, which is why step 4 is B2.
   Note this opening C1 miss never enters `tally` or `failed` — those are built
   only from `answered.slice(3)`. It steers the seed and is then discarded.
4. **B2** (`each_others_one_anothers`) — **RIGHT** (forced). Tally B2 1/1 →
   `incomplete` (total < 2) → ask B2 again.
5. **B2** (`generic_one_you_we`) — **RIGHT** (forced). Tally B2 2/2 → signal
   `up`. `cleared.add('B2')`, `next = up('B2') = 'C1'`, `failed` is empty (the
   opening C1 miss is not in it) → focus moves to C1.
6. **C1** (`having_past_participle_clauses`) — **undetermined.** Tally C1 1/1 →
   `incomplete` regardless → ask C1 again.
7. **C1** (`ing_participle_clauses`) — **undetermined, but equal to step 6.**
   Tally C1 at total = 2, and only 0/2 or 2/2 terminate here (1/2 would be
   `incomplete` → an 8th C1 question, which never happened).

## Which rule fired

Neither of the two you asked about:

- **Ambiguous-band early stop** — ruled out. It needs `total === 4` at 40–60%
  accuracy on one level. C1 only reached `total === 2`.
- **Hard cap** — ruled out. `HARD_CAP` is 15; this attempt was 7 answers, and the
  cap check sits *after* the replay loop and was never reached.
- **Actual:** one of the two C1 terminators, verified by instrumenting the real
  module:
  - C1 pair 2/2 → `if (focus === 'C1') return { kind: 'place', level: 'C1' }` (ceiling)
  - C1 pair 0/2 → `if (cleared.has(next)) return { kind: 'place', level: focus }` (down-branch boundary)

## The undetermined step

Both C1 branches are self-consistent with the stored data, so the trace cannot
be closed from the DB alone. But they mean opposite things about the student,
and that is the finding:

Placement semantics in this codebase are "the lowest level you have **not**
clearly cleared" — i.e. where to start studying, not what you've achieved.
`finalPlacement` returns the first level below `PASS_RATIO` walking up, and
`levelCheck.test.ts` asserts a student who clears through B2 is placed at C1.
Under that convention the down-branch returning `focus` is intentional, not a
bug: fail C1 after clearing B2 → study C1.

The consequence is still worth a look: **C1 is the top of `LEVELS`, so it is
simultaneously the "you topped out" placement and the "you failed the highest
tier" placement.** At every other tier those are distinct levels. A student who
answered 1/3 on C1 questions (opening miss + 0/2 pair) and a student who
answered 2/3 (opening miss + 2/2 pair) both land on C1 with an identical study
plan rebuilt by `PUT /level-check/placement`.

Timings don't settle it: q6 took ~29s and q7 ~14s, versus ~32s on the opening
C1 miss. Nothing decisive there — don't read a verdict into it.

To actually close this, the run has to be re-observed rather than recovered:
re-take the check with the console open (`onAnswered` in `LevelCheckBoard`
receives the full `Answered[]` on every step), or persist correctness. Vercel
runtime logs won't help — `/assessment/grade` request bodies aren't logged and
retention is short.

## Method / reproducibility

- Query script: `scratchpad/pull.mjs` (SELECT-only via PostgREST, service-role key
  read from `server/.env`).
- Replay: `scratchpad/replay.ts` brute-forces 2^7 patterns through an unmodified
  copy of `app/src/board/levelCheck.ts`.
- Rule identification: `scratchpad/whichrule.ts` against a copy instrumented with
  a `console.log` at each `return { kind: 'place' }` site.
- Source of truth read: `app/src/board/levelCheck.ts`,
  `app/src/board/LevelCheckBoard.tsx`,
  `server/src/modules/level-check/{levelCheck.repo.ts,levelCheck.routes.ts}`,
  `server/src/db/migrations/0004_level_check.sql`.

---

# Appendix A — C1 branch map (instrumented, 2026-09-17)

Added after the original reconstruction above. Method: `levelCheck.ts` was
temporarily instrumented with a `lcTrace` call at all six `return` sites in
`decideNext`, then driven through the real ask→answer→decide loop against the
question bank. **The instrumentation has been removed; the code is unmodified.**
Line numbers below refer to the unmodified `app/src/board/levelCheck.ts`.

This resolves the open question from the body of this document — *which* of the
two C1 terminators corresponds to which student — but it does **not** identify
which one fired in the real 112224486 session. That remains undecidable from
stored data, for the reason given in "The undetermined step" above.

| C1 pairing answers | asks | n | placed | branch that fired | state at return |
|---|---|---|---|---|---|
| 0/2 | A1,B1,C1,B2,B2,C1,C1 | 7 | C1 | **DOWN/boundary L126** → `place focus` | focus=C1 next=B2 tally=0/2 cleared=[B2] failed=[C1] |
| 1/4 | A1,B1,C1,B2,B2,C1,C1,C1,C1 | 9 | C1 | **DOWN/boundary L126** → `place focus` | focus=C1 next=B2 tally=1/4 cleared=[B2] failed=[C1] |
| 2/4 | A1,B1,C1,B2,B2,C1,C1,C1,C1 | 9 | C1 | **ambiguous early-stop L114** | focus=C1 tally=2/4 cleared=[B2] failed=[] |
| 2/2 | A1,B1,C1,B2,B2,C1,C1 | 7 | C1 | **CEILING L117** → `place 'C1'` | focus=C1 tally=2/2 cleared=[B2] failed=[] |
| 2/2, opening C1 also right | A1,B1,C1,C1,C1 | 5 | C1 | **CEILING L117** → `place 'C1'` | focus=C1 tally=2/2 cleared=[] failed=[] |

Two things worth carrying forward:

1. **The ceiling branch cannot fire on a bad C1 run.** L117 sits inside
   `if (signal === 'up')`, and `up` requires 2/2 at total 2 or >60% at total 4.
   Answering C1 badly can never produce an `up` signal, so L117 is unreachable
   under those conditions. It is *not* a hardcoded ceiling that ignores
   performance — it is gated on strong performance, and the `focus === 'C1'`
   test inside it only means "no tier above C1 to step up to."
2. **Rows 1 and 4 both reproduce the real session exactly** — same seven asks in
   the same tier order, same C1 placement, via opposite branches. That is the
   mechanical reason the stored data cannot separate them.

# Appendix B — per-tier down-branch sweep (instrumented, 2026-09-17)

Same instrumentation, sweeping a perfectly consistent student (right at or below
`trueLevel`, wrong above) across every competence level. Run against the
**unmodified** algorithm.

| Student clears | asks | n | placed | branch | focus | next | tally | cleared | failed |
|---|---|---|---|---|---|---|---|---|---|
| nothing | A1,B1,C1,A1,A1 | 5 | A1 | DOWN/floor L123 | A1 | – | 0/2 | [] | [] |
| A1 | A1,B1,C1,A2,A2,A1,A1 | 7 | A2 | UP/boundary L120 → `place next` | A1 | A2 | 2/2 | [A1] | [A2] |
| A2 | A1,B1,C1,A2,A2,B1,B1 | 7 | B1 | **DOWN/boundary L126 → `place focus`** | B1 | A2 | 0/2 | [A2] | [B1] |
| B1 | A1,B1,C1,B2,B2,B1+,B1+,B1,B1 | 9 | B1+ | UP/boundary L120 → `place next` | B1 | B1+ | 2/2 | [B1] | [B2,B1+] |
| B1+ | A1,B1,C1,B2,B2,B1+,B1+ | 7 | B2 | UP/boundary L120 → `place next` | B1+ | B2 | 2/2 | [B1+] | [B2] |
| B2 | A1,B1,C1,B2,B2,C1,C1 | 7 | C1 | **DOWN/boundary L126 → `place focus`** | C1 | B2 | 0/2 | [B2] | [C1] |
| C1 | A1,B1,C1,C1,C1 | 5 | C1 | UP/ceiling L117 | C1 | – | 2/2 | [] | [] |

## What `next` and `cleared` actually mean

- **`next = down(focus)`** in the down-branch is used **only as a lookup key** —
  "have I already cleared the tier below me?" It is never returned by that
  branch. (The *up*-branch's `next = up(focus)` *is* returned, at L120.)
- **`focus = next`** on the line below L126 is the **search step**, not a
  placement: it walks the probe down a tier and keeps asking when the boundary
  is not yet resolved. In the `clears=B1` sweep this fires repeatedly
  (`B2→B1+`, `B1+→B1`) before anything is placed.
- **`cleared` / `failed`** are rebuilt from scratch on every `decideNext` call by
  replaying only the post-opening answers. This is why the opening C1 miss never
  appears in `failed` — it steers `seedFocus` and is then discarded.

## The conclusion this sweep forces

The down-branch returns **the tier just failed, at every tier** — see the A2 row:
focus=B1 failed 0/2 with A2 cleared places at **B1**, not at the cleared A2. C1
is **not** behaving differently from the other tiers here; `place focus` is the
uniform rule.

So the placement table is a clean monotone "lowest tier NOT cleared", i.e. the
tier to start studying:

```
nothing→A1   A1→A2   A2→B1   B1→B1+   B1+→B2   B2→C1   C1→C1
```

The only irregularity is the last entry: because C1 is the top of `LEVELS`, the
pass outcome and the fail outcome coincide there, while at every other tier they
are distinct tiers. That single collision is the finding — not a broken
down-branch.

**Change considered and reverted (2026-09-17).** Special-casing the down-branch
so a failed C1 routes to B2 was implemented, tested, and backed out. It relocates
the collision rather than removing it: `B1+→B2` and `B2→B2` then share a
placement, and a student who just answered B2 2/2 gets routed back to B2. It also
contradicts `finalPlacement` (the hard-cap path), which still returns the first
tier below 80% and would answer C1 for the same student. Making pass/fail
distinct at the ceiling means changing what "placement" denotes across the whole
table — highest tier demonstrated, rather than lowest tier not cleared — which is
a rewrite of all seven rows, not a ceiling special-case.
