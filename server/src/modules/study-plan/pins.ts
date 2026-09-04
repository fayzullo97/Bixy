// Cross-family "X before Y" ordering pins (§8.12). Deliberately tiny and
// explicitly authored — NOT a full dependency graph over all 366 topics. These
// fix the handful of within-level family orderings that would otherwise feel
// broken (the doc's own example: comparatives before superlatives). A pin
// constrains one grammatical family (the `topic_id` prefix, see familyOf) to
// come before another *within the same level*; families with no pin keep their
// authored order. Add to this list as more "feels wrong" cases surface.

export interface FamilyPin {
  before: string;
  after: string;
}

export const FAMILY_PINS: FamilyPin[] = [
  // You compare two things before you rank the most/least of many (§8.12 example).
  { before: 'comparative', after: 'superlative' },
  // Understand the plain conditional pattern before contrasting first vs. second.
  { before: 'first', after: 'second' },
];
