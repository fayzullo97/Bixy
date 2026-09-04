import { TOPIC_LEVELS, type TopicLevel } from '../content/topic';
import { FAMILY_PINS, type FamilyPin } from './pins';

// Computes a student's fixed study path once, right after the level check places
// them (§8.12). Pure — no I/O — so the ordering rules are unit-tested directly.
// The path is NOT a recommendation engine or a spaced-repetition system (those
// are the deferred §6.2 item); it is a deterministic sequence built from data
// that already exists: the six-tier levels and the topic_id family naming.

/** The minimal topic shape the plan needs. `sort_order` is the authored
 *  pedagogical index from reference-material.json (§8.1), set by the seed. */
export interface PlanTopic {
  topic_id: string;
  level: string;
  sort_order: number | null;
}

/** The grammatical family a topic belongs to: the first token of its topic_id
 *  (`present_simple` → `present`, `comparative_adjectives` → `comparative`). */
export function familyOf(topicId: string): string {
  const underscore = topicId.indexOf('_');
  return underscore === -1 ? topicId : topicId.slice(0, underscore);
}

/** Tiers from the placement upward, never revisiting a tier below it (§8.12). */
function tiersFrom(placement: TopicLevel): TopicLevel[] {
  return TOPIC_LEVELS.slice(TOPIC_LEVELS.indexOf(placement));
}

/** Reorder a level's families so every pin's `before` family precedes its
 *  `after` family (§8.12). Stable: families not touched by a pin keep their
 *  incoming (authored) order. A pin whose families aren't both present is a
 *  no-op for that level. */
function applyPins(families: string[], pins: FamilyPin[]): string[] {
  const result = [...families];
  // Simple, bounded fixpoint: a few pins over a few dozen families. Each pass
  // moves an out-of-order `after` family to just past its `before`; repeat until
  // stable (or a guard trips, which would only happen on a pin cycle).
  for (let pass = 0; pass < pins.length + 1; pass++) {
    let moved = false;
    for (const pin of pins) {
      const bi = result.indexOf(pin.before);
      const ai = result.indexOf(pin.after);
      if (bi === -1 || ai === -1 || bi < ai) continue;
      // `after` currently precedes `before` — pull it out and reinsert just after.
      const fam = result.splice(ai, 1)[0]!;
      result.splice(result.indexOf(pin.before) + 1, 0, fam);
      moved = true;
    }
    if (!moved) break;
  }
  return result;
}

/** Order topics within one level: group by family, families ordered by their
 *  earliest authored topic, topics within a family by authored order, then pins. */
function orderLevel(topics: PlanTopic[], pins: FamilyPin[]): string[] {
  const byOrder = [...topics].sort(sortByAuthored);
  const families: string[] = [];
  const membersByFamily = new Map<string, string[]>();
  for (const t of byOrder) {
    const fam = familyOf(t.topic_id);
    if (!membersByFamily.has(fam)) {
      membersByFamily.set(fam, []);
      families.push(fam); // first appearance = family's slot
    }
    membersByFamily.get(fam)!.push(t.topic_id);
  }
  return applyPins(families, pins).flatMap((fam) => membersByFamily.get(fam)!);
}

/** Authored order, falling back to topic_id so a missing sort_order is still
 *  deterministic (and sorts after everything with a real order). */
function sortByAuthored(a: PlanTopic, b: PlanTopic): number {
  const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
  const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (ao !== bo) return ao - bo;
  return a.topic_id.localeCompare(b.topic_id);
}

/**
 * The full ordered path for a placement (§8.12): every tier from the placement
 * upward, each tier internally family-grouped and pinned. Returns the flat list
 * of topic_ids the student walks in order.
 */
export function buildStudyPlan(
  placement: TopicLevel,
  topics: PlanTopic[],
  pins: FamilyPin[] = FAMILY_PINS,
): string[] {
  const ordered: string[] = [];
  for (const tier of tiersFrom(placement)) {
    const atTier = topics.filter((t) => t.level === tier);
    ordered.push(...orderLevel(atTier, pins));
  }
  return ordered;
}
