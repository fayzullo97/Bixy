import { describe, expect, it } from 'vitest';
import type { MessagesClient } from '../src/modules/generation/anthropic';
import { createLessonService } from '../src/modules/generation/pipeline';
import { generateReexplanation } from '../src/modules/generation/reexplain';
import type { ContentRepo, DoodleCatalogEntry, TopicOutline } from '../src/modules/content/content.repo';
import type { LessonCacheRepo } from '../src/modules/generation/lessonCache.repo';
import type { BoardScript } from '../src/modules/generation/boardScript';

const doodles: DoodleCatalogEntry[] = [{ id: 'person_a', category: 'people', description: 'figure', url: 'u' }];

const topic: TopicOutline = {
  topic_id: 'present_perfect_tense',
  level: 'B1',
  formula: 'have / has + past participle',
  key_idea: 'Past connected to now.',
  examples: ['I have visited Samarkand.'],
  common_mistakes: ["'I have went'."],
};

// A valid re-explanation segment: Uzbek narration (Latin), English board text.
const reexplainOut = JSON.stringify({
  beats: [
    { id: 1, type: 'story_beat', narration: 'Keling, buni boshqacha qilib, yana bir bor birga koraylik hozir.', doodles: [] },
    { id: 2, type: 'formal_beat', style: 'explanation', note: 'have + past participle' },
  ],
});

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

function fakeContent(): ContentRepo {
  return {
    upsertTopics: async () => 0,
    upsertDoodles: async () => 0,
    countTopics: async () => 0,
    countDoodles: async () => 0,
    listDoodles: async () => doodles,
    getTopic: async (id) => (id === topic.topic_id ? topic : { ...topic, topic_id: id }),
    listTopicsCompact: async () => [
      { topic_id: 'present_perfect_tense', level: 'B1' },
      { topic_id: 'past_simple_tense', level: 'A2' },
    ],
    listTopicsForPlan: async () => [],
  };
}

/** Returns a canned cached script for known topics, so a detour needs no generate call. */
function seededCache(): LessonCacheRepo {
  const known = new Set(['present_perfect_tense', 'past_simple_tense']);
  return {
    get: async (t) =>
      known.has(t)
        ? ({
            topic_id: t,
            level: 'B1',
            // Carries its synthesized `speech`, or narrationComplete treats the
            // row as degraded and regenerates it (Part 02 §5).
            beats: [
              {
                id: 1,
                type: 'formal_beat',
                style: 'title',
                term: 'T',
                speech: [{ text: 'T', language: 'en', audio_url: 'https://cdn.test/t.wav' }],
              },
            ],
          } as BoardScript)
        : null,
    put: async () => {},
  };
}

function service(client: MessagesClient) {
  return createLessonService({
    anthropic: client,
    models: { generation: 'claude-haiku-4-5', topicId: 'claude-sonnet-4-6' },
    content: fakeContent(),
    cache: seededCache(),
    tts: { enabled: false, synthesize: async () => Buffer.alloc(0) },
    db: {} as never,
  });
}

describe('generateReexplanation', () => {
  it('validates and returns a short beats segment', async () => {
    const { client } = mockAnthropic([reexplainOut]);
    const { beats } = await generateReexplanation(
      { anthropic: client, model: 'm', doodles },
      { topic, language: 'uz', question: 'explain that again' },
    );
    expect(beats).toHaveLength(2);
    expect(beats[0]!.type).toBe('story_beat');
  });

  it('retries when the segment is invalid, then succeeds', async () => {
    const { client, calls } = mockAnthropic([JSON.stringify({ beats: [] }), reexplainOut]);
    const { beats } = await generateReexplanation(
      { anthropic: client, model: 'm', doodles },
      { topic, language: 'uz', question: 'again' },
    );
    expect(beats).toHaveLength(2);
    expect(calls).toHaveLength(2);
  });

  it('retries when the re-explanation is in the wrong language (§8.7)', async () => {
    const english = JSON.stringify({
      beats: [{ id: 1, type: 'story_beat', narration: 'Here is another, clearer way to see this idea.', doodles: [] }],
    });
    const russian = JSON.stringify({
      beats: [{ id: 1, type: 'story_beat', narration: 'Давай посмотрим на это ещё раз, но немного иначе.', doodles: [] }],
    });
    const { client, calls } = mockAnthropic([english, russian]);
    const { beats } = await generateReexplanation(
      { anthropic: client, model: 'm', doodles },
      { topic, language: 'ru', question: 'q' },
    );
    // english for a ru request is rejected → a second (corrected) attempt succeeds.
    expect(calls).toHaveLength(2);
    expect(beats).toHaveLength(1);
  });
});

// Every typed message now passes the identity classifier first (Part 05 §8), so
// the scripted replies below lead with its NO.
describe('pipeline.ask routing (§8.5)', () => {
  it('a typed different topic is a detour lesson', async () => {
    const { client, calls } = mockAnthropic(['NO']); // then a direct slug match — no resolver call
    const res = await service(client).ask({
      text: 'past simple tense',
      language: 'uz',
      currentTopicId: 'present_perfect_tense',
    });
    expect(res).toMatchObject({ kind: 'lesson', topicId: 'past_simple_tense' });
    expect(calls).toHaveLength(1);
  });

  it('a typed question matching no topic, mid-lesson, is a re-explanation', async () => {
    const { client } = mockAnthropic(['NO', 'NONE', reexplainOut]);
    const res = await service(client).ask({
      text: 'explain the timeline part again',
      language: 'uz',
      currentTopicId: 'present_perfect_tense',
    });
    expect(res.kind).toBe('reexplain');
  });

  it('the same topic as the current lesson is a re-explanation, not a reset', async () => {
    const { client } = mockAnthropic(['NO', reexplainOut]); // direct slug match, then reexplain
    const res = await service(client).ask({
      text: 'present perfect tense',
      language: 'uz',
      currentTopicId: 'present_perfect_tense',
    });
    expect(res.kind).toBe('reexplain');
  });

  it('an off-topic request with no current lesson is no_content', async () => {
    const { client } = mockAnthropic(['NO', 'NONE']);
    const res = await service(client).ask({ text: 'how to bake bread', language: 'uz', currentTopicId: null });
    expect(res).toEqual({ kind: 'no_content' });
  });

  it('a photo resolves to its topic and serves that lesson (a detour)', async () => {
    const { client } = mockAnthropic(['present_perfect_tense']);
    const res = await service(client).ask({
      image: { base64: 'x', mediaType: 'image/png' },
      language: 'uz',
      currentTopicId: null,
    });
    expect(res).toMatchObject({ kind: 'lesson', topicId: 'present_perfect_tense' });
  });

  it('an unreadable photo is no_content', async () => {
    const { client } = mockAnthropic(['NONE']);
    const res = await service(client).ask({
      image: { base64: 'x', mediaType: 'image/png' },
      language: 'uz',
      currentTopicId: null,
    });
    expect(res).toEqual({ kind: 'no_content' });
  });

  it('an image the vision model rejects degrades to no_content, not a 500 (§10)', async () => {
    const throwing = {
      messages: { create: async () => { throw new Error('invalid_request_error: image too small'); } },
    } as unknown as MessagesClient;
    const res = await service(throwing).ask({
      image: { base64: 'x', mediaType: 'image/png' },
      language: 'uz',
      currentTopicId: null,
    });
    expect(res).toEqual({ kind: 'no_content' });
  });
});
