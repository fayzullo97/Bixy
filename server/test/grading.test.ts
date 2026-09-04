import { describe, expect, it } from 'vitest';
import type { MessagesClient } from '../src/modules/generation/anthropic';
import { gradeFillIn, matchesAccepted, normalizeAnswer } from '../src/modules/assessment/grading';

function mockAnthropic(replies: string[]) {
  const calls: unknown[] = [];
  let i = 0;
  const client = {
    messages: {
      create: async (params: unknown) => {
        calls.push(params);
        const text = replies[Math.min(i, replies.length - 1)];
        i += 1;
        return { content: [{ type: 'text', text }] };
      },
    },
  } as unknown as MessagesClient;
  return { client, calls };
}

describe('normalizeAnswer', () => {
  it('lowercases, trims, strips punctuation, and collapses whitespace', () => {
    expect(normalizeAnswer('  Has   Visited! ')).toBe('has visited');
  });

  it('expands unambiguous contractions', () => {
    expect(normalizeAnswer("I've visited")).toBe('i have visited');
    expect(normalizeAnswer("they're going")).toBe('they are going');
    expect(normalizeAnswer("hasn't gone")).toBe('has not gone');
  });

  it('straightens curly apostrophes before expanding', () => {
    expect(normalizeAnswer('I’ve visited')).toBe('i have visited');
  });

  it('leaves ambiguous ’s / ’d forms unexpanded', () => {
    // "he's" could be "he is" or "he has" — expanding it would flip the grammar.
    // It's left as-is (the stray apostrophe just normalizes to a space), never
    // turned into "he has" / "he is".
    const norm = normalizeAnswer("he's visited");
    expect(norm).not.toContain('has');
    expect(norm).not.toContain(' is ');
    expect(norm).toBe('he s visited');
  });
});

describe('matchesAccepted', () => {
  it('matches an accepted answer regardless of case/punctuation/contraction', () => {
    expect(matchesAccepted('Has visited.', ['has visited'])).toBe(true);
    expect(matchesAccepted("I've been", ['I have been'])).toBe(true);
  });

  it('rejects a non-matching answer and an empty answer', () => {
    expect(matchesAccepted('have went', ['has visited', 'has gone'])).toBe(false);
    expect(matchesAccepted('   ', ['has visited'])).toBe(false);
  });
});

describe('gradeFillIn', () => {
  const question = { question: 'She ___ (visit) Samarkand.', accepted_answers: ['has visited'] };

  it('passes an exact match with no model call', async () => {
    const { client, calls } = mockAnthropic([]);
    const result = await gradeFillIn({ anthropic: client, model: 'm' }, question, 'has visited');
    expect(result).toEqual({ correct: true, method: 'exact' });
    expect(calls).toHaveLength(0);
  });

  it('fails an empty answer with no model call', async () => {
    const { client, calls } = mockAnthropic([]);
    const result = await gradeFillIn({ anthropic: client, model: 'm' }, question, '   ');
    expect(result).toEqual({ correct: false, method: 'exact' });
    expect(calls).toHaveLength(0);
  });

  it('falls back to the AI judge when nothing matches, honoring YES', async () => {
    const { client, calls } = mockAnthropic(['YES']);
    const result = await gradeFillIn({ anthropic: client, model: 'm' }, question, 'has already visited');
    expect(result).toEqual({ correct: true, method: 'ai' });
    expect(calls).toHaveLength(1);
  });

  it('falls back to the AI judge when nothing matches, honoring NO', async () => {
    const { client } = mockAnthropic(['NO']);
    const result = await gradeFillIn({ anthropic: client, model: 'm' }, question, 'have went');
    expect(result).toEqual({ correct: false, method: 'ai' });
  });
});
