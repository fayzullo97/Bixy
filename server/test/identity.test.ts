import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MessagesClient } from '../src/modules/generation/anthropic';
import { deflectIdentity, isIdentityQuestion } from '../src/modules/generation/identity';
import { createLessonService } from '../src/modules/generation/pipeline';
import type { ContentRepo, DoodleCatalogEntry, TopicOutline } from '../src/modules/content/content.repo';
import type { LessonCacheRepo } from '../src/modules/generation/lessonCache.repo';

const doodles: DoodleCatalogEntry[] = [
  { id: 'person_a', category: 'people', description: 'figure', url: 'u' },
];

const topic: TopicOutline = {
  topic_id: 'present_perfect_tense',
  level: 'B1',
  formula: 'have / has + past participle',
  key_idea: 'Past connected to now.',
  examples: ['I have visited Samarkand.'],
  common_mistakes: ["'I have went'."],
};

/** Replies in order, then repeats the last one. Records every request. */
function scriptedAnthropic(replies: string[]) {
  const calls: Array<{ system?: unknown; messages: Array<{ content: unknown }> }> = [];
  let i = 0;
  const client = {
    messages: {
      create: async (params: never) => {
        calls.push(params as never);
        const text = replies[Math.min(i, replies.length - 1)];
        i += 1;
        return { content: [{ type: 'text', text }] };
      },
    },
  } as unknown as MessagesClient;
  return { client, calls };
}

function throwingAnthropic() {
  return {
    messages: { create: async () => { throw new Error('overloaded_error'); } },
  } as unknown as MessagesClient;
}

describe('identity classification (Part 05 §8)', () => {
  it('reads YES as an identity question', async () => {
    const { client } = scriptedAnthropic(['YES']);
    expect(await isIdentityQuestion(client, 'claude-haiku-4-5', 'are you a bot?')).toBe(true);
  });

  it('reads anything else as an ordinary message', async () => {
    const { client } = scriptedAnthropic(['NO']);
    expect(await isIdentityQuestion(client, 'claude-haiku-4-5', 'explain present perfect')).toBe(false);
  });

  it('fails open — a classifier blip costs a deflection, never the lesson request', async () => {
    expect(await isIdentityQuestion(throwingAnthropic(), 'claude-haiku-4-5', 'are you real?')).toBe(false);
  });

  it('spends a tiny budget, since it runs on every typed message', async () => {
    const { client, calls } = scriptedAnthropic(['NO']);
    await isIdentityQuestion(client, 'claude-haiku-4-5', 'hello');
    expect((calls[0] as unknown as { max_tokens: number }).max_tokens).toBeLessThanOrEqual(5);
  });
});

describe('identity deflection (Part 05 §8)', () => {
  it('answers in character', async () => {
    const { client } = scriptedAnthropic(["I'm Bixy — not a person, but I'm right here."]);
    const reply = await deflectIdentity(client, 'claude-haiku-4-5', 'are you human?', 'en');
    expect(reply).toContain('Bixy');
  });

  it('falls back to a written line in the student’s language rather than going silent', async () => {
    const reply = await deflectIdentity(throwingAnthropic(), 'claude-haiku-4-5', 'ты человек?', 'ru');
    expect(reply).toContain('Бикси');
  });

  it('falls back when the model returns an empty reply', async () => {
    const { client } = scriptedAnthropic(['']);
    expect(await deflectIdentity(client, 'claude-haiku-4-5', 'are you real?', 'en')).toContain('Bixy');
  });
});

describe('ask() routes an identity question before anything else (Part 05 §8)', () => {
  const content: ContentRepo = {
    upsertTopics: async () => 0,
    upsertDoodles: async () => 0,
    countTopics: async () => 0,
    countDoodles: async () => 0,
    listDoodles: async () => doodles,
    getTopic: async (id) => (id === topic.topic_id ? topic : null),
    listTopicsCompact: async () => [{ topic_id: topic.topic_id, level: 'B1' }],
    listTopicsForPlan: async () => [{ topic_id: topic.topic_id, level: 'B1', sort_order: 0 }],
  };
  const cache: LessonCacheRepo = { get: async () => null, put: async () => {} };

  function service(replies: string[]) {
    const { client, calls } = scriptedAnthropic(replies);
    return {
      calls,
      svc: createLessonService({
        anthropic: client,
        models: { generation: 'claude-haiku-4-5', topicId: 'claude-sonnet-4-6' },
        content,
        cache,
        tts: { enabled: false, synthesize: async () => Buffer.alloc(0) },
        db: {} as SupabaseClient,
      }),
    };
  }

  it('deflects with a lesson open, instead of re-explaining something unasked', async () => {
    const { svc, calls } = service(['YES', 'Bixy here — not a person, but genuinely paying attention.']);
    const result = await svc.ask({ text: 'are you a real teacher?', language: 'en', currentTopicId: topic.topic_id });

    expect(result.kind).toBe('identity');
    expect(result.kind === 'identity' && result.text).toContain('Bixy');
    // Classify, then deflect — and nothing else. No topic resolution, no
    // re-explanation of the open lesson.
    expect(calls).toHaveLength(2);
  });

  it('deflects with NO lesson open, instead of "I don’t have information about that"', async () => {
    const { svc } = service(['YES', 'Not a person — but I am here.']);
    const result = await svc.ask({ text: 'am I talking to a human?', language: 'en', currentTopicId: null });
    expect(result.kind).toBe('identity');
  });

  it('leaves an ordinary message alone, and the rest of ask() decides it', async () => {
    // NO from the classifier, then the topic resolver finding no match — the
    // pre-existing path, reached exactly as before.
    const { svc, calls } = service(['NO', 'NONE']);
    const result = await svc.ask({ text: 'what is the weather', language: 'en', currentTopicId: null });
    expect(result.kind).toBe('no_content');
    expect(calls).toHaveLength(2); // classifier, then topic resolution
  });
});
