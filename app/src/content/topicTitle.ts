/**
 * A readable title for a topic (Part 07 §9) — the topic-block card and the level
 * screens both list topics by name, and the content has no name to list.
 *
 * `reference-material.json` gives every topic an outline (formula, key idea,
 * examples, mistakes) but no display title; `topic_id` is the only human-shaped
 * handle on a topic that exists. So the title is derived from it, rather than
 * inventing a second authored field that 366 topics would each need filled in.
 *
 * The design mocks up short curated names ("Which vs What", "Modal Verbs").
 * Derivation gets most of the way there for short ids and produces a long but
 * accurate phrase for the specific ones ("Present simple vs perfect future time
 * clause meaning"); the rows truncate, so long is survivable and wrong is not.
 */

/** Tokens whose casing or spelling can't be recovered by title-casing alone. */
const TOKEN_OVERRIDES: Record<string, string> = {
  // Kept lowercase: they read as grammar prose, not as part of a proper name.
  vs: 'vs',
  and: 'and',
  or: 'or',
  of: 'of',
  at: 'at',
  in: 'in',
  to: 'to',
  for: 'for',
  the: 'the',
  a: 'a',
  as: 'as',
  no: 'no',
  not: 'not',
  it: 'it',
  so: 'so',
  if: 'if',
  // Grammar terms that are written with a hyphen or a capital.
  ing: '-ing',
  ed: '-ed',
  s: '-s',
  cefr: 'CEFR',
};

function token(raw: string, first: boolean): string {
  const override = TOKEN_OVERRIDES[raw];
  if (override !== undefined) {
    // A lowercase particle still takes a capital when it opens the title.
    if (!first || override.startsWith('-')) return override;
    return override.charAt(0).toUpperCase() + override.slice(1);
  }
  // Sentence case: only the opening token takes a capital.
  return first ? raw.charAt(0).toUpperCase() + raw.slice(1) : raw;
}

/**
 * `present_simple_be` → `Present simple be`; `which_that_vs_what_relative` →
 * `Which that vs what relative`. Sentence case, not title case: these are
 * descriptions of a grammar point, and capitalizing every word reads as a
 * headline rather than a topic.
 */
export function topicTitle(topicId: string): string {
  const parts = topicId.split('_').filter((p) => p.length > 0);
  if (parts.length === 0) return topicId;
  return parts.map((p, i) => token(p, i === 0)).join(' ').replace(/ -/g, '-');
}

/**
 * The one-line subtitle under a topic's title: the first sentence of its key
 * idea, which is authored per topic and actually describes it.
 *
 * The design's mocked subtitles are placeholder filler repeated across unrelated
 * rows ("Study of sounds in language" under a grammar topic), so they're not
 * carried over — the real content says something true about each topic.
 */
export function topicSubtitle(keyIdea: string | null | undefined): string {
  if (!keyIdea) return '';
  const trimmed = keyIdea.trim();
  // Split on the first sentence end that isn't an abbreviation-sized fragment.
  const match = /^(.{20,}?[.!?])\s/.exec(trimmed);
  return (match?.[1] ?? trimmed).trim();
}
