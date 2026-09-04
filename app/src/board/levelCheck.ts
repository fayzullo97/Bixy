// The level-check adaptive algorithm (§8.11). Pure — no React, no I/O — so the
// logic that actually decides a student's placement is unit-tested directly, the
// same way mastery branching (§8.4) is. The server owns the question bank, the
// seen-tracking, grading (reused from §8.4) and persistence; this module only
// decides which level to ask next and where to finally place the student.

export const LEVELS = ['A1', 'A2', 'B1', 'B1+', 'B2', 'C1'] as const;
export type Level = (typeof LEVELS)[number];

/** Coarse low/mid/high opening read, in ask order (§8.11). */
export const OPENING_LEVELS: readonly Level[] = ['A1', 'B1', 'C1'];

/** No more than this many questions in one attempt (§8.11 hard cap). */
export const HARD_CAP = 15;

/** "Clearly cleared" threshold used by final placement (§8.11, ~80%+). */
export const PASS_RATIO = 0.8;

/** The "I'm a complete beginner" skip places directly at the floor (§8.11). */
export const SKIP_LEVEL: Level = 'A1';

export interface Answered {
  level: Level;
  correct: boolean;
}

export type Decision =
  | { kind: 'ask'; level: Level }
  | { kind: 'place'; level: Level };

const indexOf = (level: Level): number => LEVELS.indexOf(level);
const up = (level: Level): Level => LEVELS[Math.min(indexOf(level) + 1, LEVELS.length - 1)];
const down = (level: Level): Level => LEVELS[Math.max(indexOf(level) - 1, 0)];

/**
 * Where to begin the pair search after the 3 opening reads. The opening gives a
 * low/mid/high signal; we seed at the middle of the still-uncertain band so the
 * pairs narrow in from there (doc leaves the exact seed to the implementation):
 *   C1 correct            → confirm the ceiling at C1
 *   B1 correct, C1 wrong  → B2  (band B1+..C1)
 *   A1 correct, B1 wrong  → A2  (band A2..B1)
 *   A1 wrong              → A1  (likely floor)
 */
function seedFocus(opening: Answered[]): Level {
  const [a1, b1, c1] = opening;
  if (c1.correct) return 'C1';
  if (b1.correct) return 'B2';
  if (a1.correct) return 'A2';
  return 'A1';
}

type Signal = 'incomplete' | 'up' | 'down' | 'ambiguous';

/**
 * Read a level's pairing tally (§8.11):
 *   2/2 → up      0/2 → down      1/2 → keep going (incomplete → 4 total)
 *   at 4: a clear majority resolves up/down; 40–60% is the early-stop signal.
 */
function signalOf(correct: number, total: number): Signal {
  if (total < 2) return 'incomplete';
  if (total === 2) {
    if (correct === 2) return 'up';
    if (correct === 0) return 'down';
    return 'incomplete'; // 1/2 mixed — ask 2 more, re-evaluate at 4
  }
  if (total === 3) return 'incomplete';
  const acc = correct / total;
  if (acc > 0.6) return 'up';
  if (acc < 0.4) return 'down';
  return 'ambiguous';
}

/** Hard-cap / clean-finish fallback: walk up from the lowest level tested and
 *  place at the first level the student has NOT clearly cleared (§8.11). */
export function finalPlacement(answered: Answered[]): Level {
  let highestCleared: Level | null = null;
  for (const level of LEVELS) {
    const at = answered.filter((a) => a.level === level);
    if (at.length === 0) continue;
    const acc = at.filter((a) => a.correct).length / at.length;
    if (acc < PASS_RATIO) return level; // first not-cleared, walking up
    highestCleared = level;
  }
  return highestCleared ?? SKIP_LEVEL;
}

/**
 * The next action given everything answered so far. A pure function of the ask
 * history: opening reads, then a pair search that steps up/down and stops at a
 * floor, a ceiling, a resolved boundary, or an early 40–60% signal — capped at
 * HARD_CAP questions.
 */
export function decideNext(answered: Answered[]): Decision {
  // Opening round: one each at A1, B1, C1 (§8.11).
  if (answered.length < OPENING_LEVELS.length) {
    return { kind: 'ask', level: OPENING_LEVELS[answered.length] };
  }

  let focus = seedFocus(answered.slice(0, OPENING_LEVELS.length));
  const tally = new Map<Level, { c: number; t: number }>();
  const cleared = new Set<Level>(); // levels resolved 'up'
  const failed = new Set<Level>(); // levels resolved 'down'

  // Replay the pairing answers (everything after the opening) to find the
  // current focus, terminating as soon as a placement is forced.
  for (const ans of answered.slice(OPENING_LEVELS.length)) {
    const cur = tally.get(focus) ?? { c: 0, t: 0 };
    cur.t += 1;
    if (ans.correct) cur.c += 1;
    tally.set(focus, cur);

    const signal = signalOf(cur.c, cur.t);
    if (signal === 'incomplete') continue;
    if (signal === 'ambiguous') return { kind: 'place', level: focus }; // early stop

    if (signal === 'up') {
      if (focus === 'C1') return { kind: 'place', level: 'C1' }; // ceiling
      cleared.add(focus);
      const next = up(focus);
      if (failed.has(next)) return { kind: 'place', level: next }; // boundary
      focus = next;
    } else {
      if (focus === 'A1') return { kind: 'place', level: 'A1' }; // floor
      failed.add(focus);
      const next = down(focus);
      if (cleared.has(next)) return { kind: 'place', level: focus }; // boundary
      focus = next;
    }
  }

  if (answered.length >= HARD_CAP) return { kind: 'place', level: finalPlacement(answered) };
  return { kind: 'ask', level: focus };
}

/**
 * Pick the next question to show at a level. Prefers one the student has never
 * seen (across attempts + retakes, §8.11), never repeats one already used this
 * attempt, and falls back to a seen question once the level's pool is exhausted.
 */
export function pickQuestion<Q extends { id: string; level: string }>(
  level: Level,
  bank: Q[],
  seen: ReadonlySet<string>,
  usedThisAttempt: ReadonlySet<string>,
): Q | null {
  const candidates = bank.filter((q) => q.level === level && !usedThisAttempt.has(q.id));
  if (candidates.length === 0) return null;
  const unseen = candidates.filter((q) => !seen.has(q.id));
  return (unseen.length > 0 ? unseen : candidates)[0];
}
