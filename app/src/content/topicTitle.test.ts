import { describe, expect, it } from 'vitest';
import { topicTitle, topicSubtitle } from './topicTitle';

describe('topicTitle', () => {
  it('sentence-cases a multi-word id', () => {
    expect(topicTitle('present_simple_be')).toBe('Present simple be');
  });

  it('keeps grammar particles lowercase inside the title', () => {
    expect(topicTitle('which_that_vs_what_relative')).toBe('Which that vs what relative');
    expect(topicTitle('prepositions_at_end_of_question')).toBe('Prepositions at end of question');
  });

  it('capitalizes a particle that opens the title', () => {
    expect(topicTitle('the_definite_article')).toBe('The definite article');
    expect(topicTitle('if_so_if_not')).toBe('If so if not');
  });

  it('hyphenates the -ing / -ed suffix tokens', () => {
    expect(topicTitle('ing_participle_clauses')).toBe('-ing participle clauses');
    expect(topicTitle('verbs_gerund_or_infinitive')).toBe('Verbs gerund or infinitive');
    expect(topicTitle('for_ing_purpose_of_object')).toBe('For-ing purpose of object');
  });

  it('handles a single-token id', () => {
    expect(topicTitle('imperative')).toBe('Imperative');
    expect(topicTitle('quantifiers')).toBe('Quantifiers');
  });

  it('falls back to the raw id when there is nothing to split', () => {
    expect(topicTitle('')).toBe('');
    expect(topicTitle('___')).toBe('___');
  });
});

describe('topicSubtitle', () => {
  it('takes the first sentence of the key idea', () => {
    expect(
      topicSubtitle("The verb 'be' always needs a subject in front of it, and its form changes. It's one of the most-used verbs."),
    ).toBe("The verb 'be' always needs a subject in front of it, and its form changes.");
  });

  it('returns the whole text when there is only one sentence', () => {
    expect(topicSubtitle('A single sentence about grammar.')).toBe('A single sentence about grammar.');
  });

  it('is empty for missing content rather than throwing', () => {
    expect(topicSubtitle(null)).toBe('');
    expect(topicSubtitle(undefined)).toBe('');
    expect(topicSubtitle('   ')).toBe('');
  });
});
