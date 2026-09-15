import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MessagesClient } from '../src/modules/generation/anthropic';
import { generateLesson } from '../src/modules/generation/generateLesson';
import { identifyTopicFromText } from '../src/modules/generation/identifyTopic';
import { createLessonService } from '../src/modules/generation/pipeline';
import { buildSystemPrompt } from '../src/modules/generation/systemPrompt';
import { chunkByChars, concatWav } from '../src/modules/tts/wav';
import type {
  ContentRepo,
  DoodleCatalogEntry,
  TopicOutline,
} from '../src/modules/content/content.repo';
import type { TtsClient } from '../src/modules/tts/client';
import type { LessonCacheRepo } from '../src/modules/generation/lessonCache.repo';
import { parseBoardScript, type BoardScript } from '../src/modules/generation/boardScript';

const doodles: DoodleCatalogEntry[] = [
  { id: 'person_a', category: 'people', description: 'figure', url: 'u' },
  { id: 'person_b', category: 'people', description: 'figure', url: 'u' },
  { id: 'suitcase', category: 'objects', description: 'bag', url: 'u' },
  { id: 'face_happy', category: 'expressions', description: 'smile', url: 'u' },
  { id: 'speech_bubble', category: 'communication', description: 'bubble', url: 'u' },
];

const topic: TopicOutline = {
  topic_id: 'present_perfect_tense',
  level: 'B1',
  formula: 'have / has + past participle',
  key_idea: 'Past connected to now.',
  examples: ['I have visited Samarkand.'],
  common_mistakes: ["'I have went'."],
};

// A minimal but complete quiz: 10 questions (the §8.4 floor), a blend of types,
// each tagging one of the three beats below.
const validQuiz: BoardScript['quiz'] = Array.from({ length: 10 }, (_, i) => {
  const beat = ((i % 3) + 1) as 1 | 2 | 3;
  if (i === 0) {
    return {
      quiz_question_id: 1,
      type: 'fill_in_the_blank',
      question: 'She ___ (visit) Samarkand.',
      accepted_answers: ['has visited'],
      tests_beat_id: 1,
    };
  }
  if (i === 1) {
    return {
      quiz_question_id: 2,
      type: 'true_false',
      question: '"I have went" is correct.',
      options: ['True', 'False'],
      correct_index: 1,
      tests_beat_id: 3,
    };
  }
  return {
    quiz_question_id: i + 1,
    type: 'multiple_choice',
    question: `Which is correct? (${i})`,
    options: ['I have went', 'I have gone'],
    correct_index: 1,
    tests_beat_id: beat,
  };
});

const validScript: BoardScript = {
  topic_id: 'present_perfect_tense',
  level: 'B1',
  beats: [
    { id: 1, type: 'formal_beat', style: 'title', term: 'Present Perfect' },
    { id: 2, type: 'story_beat', narration: 'Salom!', doodles: [{ element_id: 'person_a', position: 'left' }] },
    {
      id: 3,
      type: 'formal_beat',
      style: 'check_in_question',
      question: 'Which one?',
      options: ['a', 'b'],
      correct_index: 1,
      wrong_answer_reactions: { '0': 'not quite' },
    },
  ],
  quiz: validQuiz,
  quiz_intro: "Okay, let's see how much of that stuck.",
};

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

describe('buildSystemPrompt', () => {
  it('embeds the persona and the full doodle catalog', () => {
    const prompt = buildSystemPrompt(doodles);
    expect(prompt).toContain('Bixy');
    expect(prompt).toContain('person_a');
    expect(prompt).toContain('speech_bubble');
  });
});

describe('generateLesson', () => {
  it('parses and validates a good response, sending the persona as a cached block', async () => {
    const { client, calls } = mockAnthropic([JSON.stringify(validScript)]);
    const { script, attempts } = await generateLesson(
      { anthropic: client, model: 'claude-haiku-4-5', doodles },
      { topic, language: 'uz' },
    );
    expect(attempts).toBe(1);
    expect(script.beats).toHaveLength(3);
    const params = calls[0] as { system: Array<{ cache_control?: unknown }> };
    expect(params.system[0]?.cache_control).toEqual({ type: 'ephemeral' });
  });

  it('retries once when the first output is invalid', async () => {
    const bad = JSON.stringify({ ...validScript, beats: [{ id: 1, type: 'story_beat', doodles: [] }] });
    const { client, calls } = mockAnthropic([bad, JSON.stringify(validScript)]);
    const { attempts } = await generateLesson(
      { anthropic: client, model: 'claude-haiku-4-5', doodles },
      { topic, language: 'en' },
    );
    expect(attempts).toBe(2);
    expect(calls).toHaveLength(2);
  });

  it('tolerates markdown fences around the JSON', async () => {
    const { client } = mockAnthropic(['```json\n' + JSON.stringify(validScript) + '\n```']);
    const { script } = await generateLesson(
      { anthropic: client, model: 'claude-haiku-4-5', doodles },
      // uz, matching the fixture's Uzbek narration — this test is about fence
      // tolerance, and asking for `ru` would (correctly) trip the language check.
      { topic, language: 'uz' },
    );
    expect(script.topic_id).toBe('present_perfect_tense');
  });

  it('returns the quiz alongside the beats', async () => {
    const { client } = mockAnthropic([JSON.stringify(validScript)]);
    const { script } = await generateLesson(
      { anthropic: client, model: 'claude-haiku-4-5', doodles },
      { topic, language: 'en' },
    );
    expect(script.quiz).toHaveLength(10);
  });

  it('retries when the model omits the required quiz', async () => {
    const { quiz, ...noQuiz } = validScript;
    void quiz;
    const { client, calls } = mockAnthropic([JSON.stringify(noQuiz), JSON.stringify(validScript)]);
    const { attempts } = await generateLesson(
      { anthropic: client, model: 'claude-haiku-4-5', doodles },
      { topic, language: 'en' },
    );
    expect(attempts).toBe(2);
    expect(calls).toHaveLength(2);
  });
});

/** Like mockAnthropic, but each turn either throws (a failed generation call) or replies. */
function flakyAnthropic(turns: Array<{ throw?: unknown; reply?: string }>) {
  const calls: unknown[] = [];
  let i = 0;
  const client = {
    messages: {
      create: async (params: unknown) => {
        calls.push(params);
        const turn = turns[Math.min(i, turns.length - 1)]!;
        i += 1;
        if (turn.throw !== undefined) throw turn.throw;
        return { content: [{ type: 'text', text: turn.reply }] };
      },
    },
  } as unknown as MessagesClient;
  return { client, calls };
}

/** validScript with its single story beat's narration swapped. */
function withNarration(narration: string): BoardScript {
  return {
    ...validScript,
    beats: validScript.beats.map((b) => (b.type === 'story_beat' ? { ...b, narration } : b)),
  };
}

describe('generateLesson failure handling (§8.10)', () => {
  it('retries a failed generation call, then succeeds', async () => {
    const { client, calls } = flakyAnthropic([
      { throw: new Error('overloaded_error') },
      { reply: JSON.stringify(validScript) },
    ]);
    const { attempts } = await generateLesson(
      { anthropic: client, model: 'claude-haiku-4-5', doodles },
      { topic, language: 'uz' },
    );
    expect(attempts).toBe(2);
    expect(calls).toHaveLength(2);
  });

  it('throws a clean error when the generation call keeps failing', async () => {
    const { client, calls } = flakyAnthropic([{ throw: new Error('ETIMEDOUT') }]);
    await expect(
      generateLesson({ anthropic: client, model: 'claude-haiku-4-5', doodles }, { topic, language: 'uz' }),
    ).rejects.toThrow(/lesson generation failed after 3 attempts/);
    expect(calls).toHaveLength(3);
  });

  it('retries when narration comes back in the wrong language for the request (§8.7)', async () => {
    const englishForRu = withNarration('This is clearly an English narration sentence for the lesson.');
    const russian = withNarration('Это предложение на русском языке для повествования этого урока.');
    const { client, calls } = flakyAnthropic([
      { reply: JSON.stringify(englishForRu) },
      { reply: JSON.stringify(russian) },
    ]);
    const { attempts } = await generateLesson(
      { anthropic: client, model: 'claude-haiku-4-5', doodles },
      { topic, language: 'ru' },
    );
    expect(attempts).toBe(2);
    const second = calls[1] as { messages: Array<{ content: string }> };
    expect(second.messages[0]!.content).toMatch(/Russian|Cyrillic|language/i);
  });
});

describe('quiz validation (§8.4)', () => {
  it('accepts a valid quiz and a script without one', () => {
    expect(parseBoardScript(validScript).quiz).toHaveLength(10);
    const { quiz, ...noQuiz } = validScript;
    void quiz;
    expect(parseBoardScript(noQuiz).quiz).toBeUndefined();
  });

  it('rejects a quiz outside the 10–15 range', () => {
    const short = { ...validScript, quiz: validScript.quiz!.slice(0, 5) };
    expect(() => parseBoardScript(short)).toThrow(/10.*15|questions/);
  });

  it('rejects a question tagging a non-existent beat', () => {
    const quiz = validScript.quiz!.map((q, i) => (i === 0 ? { ...q, tests_beat_id: 99 } : q));
    expect(() => parseBoardScript({ ...validScript, quiz })).toThrow(/tests_beat_id/);
  });

  it('rejects a fill-in-the-blank question with no accepted_answers', () => {
    const quiz = validScript.quiz!.map((q, i) =>
      i === 0 ? { quiz_question_id: 1, type: 'fill_in_the_blank', question: 'x?', tests_beat_id: 1 } : q,
    );
    expect(() => parseBoardScript({ ...validScript, quiz })).toThrow(/accepted_answers/);
  });
});

describe('identifyTopicFromText', () => {
  const topics = [
    { topic_id: 'present_perfect_tense', level: 'B1' },
    { topic_id: 'past_simple_tense', level: 'A2' },
  ];

  it('matches a slug directly without a model call', async () => {
    const { client, calls } = mockAnthropic([]);
    const res = await identifyTopicFromText({ anthropic: client, topics }, 'm', 'past simple tense');
    expect(res).toEqual({ ok: true, topicId: 'past_simple_tense' });
    expect(calls).toHaveLength(0);
  });

  it('falls back to the model for free phrasing', async () => {
    const { client } = mockAnthropic(['present_perfect_tense']);
    const res = await identifyTopicFromText({ anthropic: client, topics }, 'm', 'the have/has one');
    expect(res).toEqual({ ok: true, topicId: 'present_perfect_tense' });
  });

  it('returns not-found when the model says NONE', async () => {
    const { client } = mockAnthropic(['NONE']);
    const res = await identifyTopicFromText({ anthropic: client, topics }, 'm', 'how to bake bread');
    expect(res).toEqual({ ok: false });
  });
});

/** Minimal valid PCM16 mono 24kHz WAV — narrate() reads the format off real clips. */
function fakeWav(dataBytes = 480): Buffer {
  const data = Buffer.alloc(dataBytes);
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24000, 24);
  header.writeUInt32LE(24000 * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

describe('pipeline result cache', () => {
  function fakeContent(): ContentRepo {
    return {
      upsertTopics: async () => 0,
      upsertDoodles: async () => 0,
      countTopics: async () => 0,
      countDoodles: async () => 0,
      listDoodles: async () => doodles,
      getTopic: async (id) => (id === topic.topic_id ? topic : null),
      listTopicsCompact: async () => [{ topic_id: topic.topic_id, level: 'B1' }],
      listTopicsForPlan: async () => [{ topic_id: topic.topic_id, level: 'B1', sort_order: 0 }],
    };
  }
  function fakeCache(seed?: BoardScript): LessonCacheRepo {
    const store = new Map<string, BoardScript>();
    if (seed) store.set(`${seed.topic_id}:reference_material:uz`, seed);
    return {
      get: async (t, s, l) => store.get(`${t}:${s}:${l}`) ?? null,
      put: async (t, s, l, script) => void store.set(`${t}:${s}:${l}`, script),
    };
  }

  // Storage stub so narration "uploads" succeed and audio_url gets filled in.
  function fakeStorageDb(): SupabaseClient {
    return {
      storage: {
        getBucket: async () => ({ data: { name: 'narration' }, error: null }),
        createBucket: async () => ({ error: null }),
        from: () => ({
          upload: async () => ({ error: null }),
          getPublicUrl: (p: string) => ({ data: { publicUrl: `https://cdn.test/${p}` } }),
        }),
      },
    } as unknown as SupabaseClient;
  }
  const workingTts = { enabled: true, synthesize: async () => fakeWav() };

  function makeService(over: { cache?: LessonCacheRepo; tts?: TtsClient; client: MessagesClient }) {
    return createLessonService({
      anthropic: over.client,
      models: { generation: 'claude-haiku-4-5', topicId: 'claude-sonnet-4-6' },
      content: fakeContent(),
      cache: over.cache ?? fakeCache(),
      tts: over.tts ?? workingTts,
      db: fakeStorageDb(),
    });
  }

  it('synthesizes every unit by ITS language, not the lesson\'s (Part 02 §5)', async () => {
    const script = {
      ...validScript,
      beats: [
        { id: 1, type: 'formal_beat', style: 'title', term: 'Present Perfect' },
        {
          id: 2,
          type: 'formal_beat',
          style: 'common_mistake',
          wrong: 'I have visit Samarkand.',
          correct: 'I have visited Samarkand.',
          note: 'После have нужно причастие прошедшего времени, а не обычная форма.',
        },
        { id: 3, type: 'story_beat', narration: 'Это короткое повествование на русском языке.', doodles: [] },
      ],
      quiz_intro: 'Хорошо, посмотрим, что запомнилось.',
    };
    const spoken: Array<{ text: string; language: string }> = [];
    const recordingTts = {
      enabled: true,
      synthesize: async (text: string, language: string) => {
        spoken.push({ text, language });
        return fakeWav();
      },
    };
    const { client } = mockAnthropic([JSON.stringify(script)]);
    const service = makeService({ client, tts: recordingTts });
    const res = await service.getLesson({ topicId: topic.topic_id, language: 'ru' });
    expect(res).toMatchObject({ ok: true });

    // The English-locked fields route to the English voice even inside a Russian
    // lesson; the localized ones route to Russian. That split is the whole reason
    // language lives on the unit rather than the beat.
    //
    // Compared as a set: clips are synthesized concurrently, so completion order
    // carries no meaning — the text→language pairing is what matters. Playback
    // order is fixed by the `speech` arrays, asserted separately below.
    const key = (u: { text: string; language: string }) => `${u.language}::${u.text}`;
    expect(spoken.map(key).sort()).toEqual(
      [
        { text: 'Present Perfect', language: 'en' },
        { text: 'I have visit Samarkand.', language: 'en' },
        { text: 'I have visited Samarkand.', language: 'en' },
        { text: 'После have нужно причастие прошедшего времени, а не обычная форма.', language: 'ru' },
        { text: 'Это короткое повествование на русском языке.', language: 'ru' },
        { text: 'Хорошо, посмотрим, что запомнилось.', language: 'ru' },
      ]
        .map(key)
        .sort(),
    );

    // Playback order within a beat is the board's reading order: the wrong form,
    // then the fix, then the explanation.
    const mistake = res.ok ? res.boardScript.beats.find((b) => b.type === 'formal_beat' && b.style === 'common_mistake') : undefined;
    expect(mistake?.speech?.map((u) => u.text)).toEqual([
      'I have visit Samarkand.',
      'I have visited Samarkand.',
      'После have нужно причастие прошедшего времени, а не обычная форма.',
    ]);
  });

  it('never speaks the end-of-topic test itself', async () => {
    const spoken: string[] = [];
    const recordingTts = {
      enabled: true,
      synthesize: async (text: string) => {
        spoken.push(text);
        return fakeWav();
      },
    };
    const { client } = mockAnthropic([JSON.stringify(validScript)]);
    const service = makeService({ client, tts: recordingTts });
    await service.getLesson({ topicId: topic.topic_id, language: 'uz' });

    for (const q of validQuiz ?? []) {
      expect(spoken).not.toContain(q.question);
      for (const option of q.options ?? []) expect(spoken).not.toContain(option);
    }
    // ...but the hand-off line into it IS spoken.
    expect(spoken).toContain(validScript.quiz_intro);
  });

  it('keys the cache by EFFECTIVE language: a C1 topic collapses en/uz/ru to one row', async () => {
    // Part 01 §1 — C1 is fully English whatever the student selected, so all
    // three requests must share a single cached English row, not generate three.
    const c1Topic: TopicOutline = { ...topic, topic_id: 'c1_inversion', level: 'C1' };
    const c1Content: ContentRepo = { ...fakeContent(), getTopic: async () => c1Topic };
    const keys: string[] = [];
    const store = new Map<string, BoardScript>();
    const cache: LessonCacheRepo = {
      get: async (t, src, l) => {
        keys.push(l);
        return store.get(`${t}:${src}:${l}`) ?? null;
      },
      put: async (t, src, l, script) => void store.set(`${t}:${src}:${l}`, script),
    };

    const { client, calls } = mockAnthropic([JSON.stringify({ ...validScript, topic_id: 'c1_inversion', level: 'C1' })]);
    const service = createLessonService({
      anthropic: client,
      models: { generation: 'claude-haiku-4-5', topicId: 'claude-sonnet-4-6' },
      content: c1Content,
      cache,
      tts: workingTts,
      db: fakeStorageDb(),
    });

    expect(await service.getLesson({ topicId: 'c1_inversion', language: 'ru' })).toMatchObject({ cached: false });
    expect(await service.getLesson({ topicId: 'c1_inversion', language: 'uz' })).toMatchObject({ cached: true });
    expect(await service.getLesson({ topicId: 'c1_inversion', language: 'en' })).toMatchObject({ cached: true });

    expect(keys).toEqual(['en', 'en', 'en']); // never looked up under ru/uz
    expect(store.size).toBe(1);
    expect(calls).toHaveLength(1); // generated once, not three times
  });

  it('keeps A1–B2 lessons separated per language', async () => {
    const { client, calls } = mockAnthropic([JSON.stringify(validScript)]);
    const service = makeService({ client });

    await service.getLesson({ topicId: topic.topic_id, language: 'uz' });
    await service.getLesson({ topicId: topic.topic_id, language: 'en' });
    expect(calls).toHaveLength(2); // B1 — no collapsing
  });

  it('generates + audios on a miss, then serves the second request from cache', async () => {
    const { client, calls } = mockAnthropic([JSON.stringify(validScript)]);
    const service = makeService({ client });

    const first = await service.getLesson({ topicId: topic.topic_id, language: 'uz' });
    expect(first).toMatchObject({ ok: true, cached: false });
    expect(calls).toHaveLength(1);

    const second = await service.getLesson({ topicId: topic.topic_id, language: 'uz' });
    expect(second).toMatchObject({ ok: true, cached: true });
    expect(calls).toHaveLength(1); // no new model call
  });

  it('never caches — and fails loudly — when a beat’s audio can’t be produced (§8.10)', async () => {
    const cache = fakeCache();
    const failingTts = { enabled: true, synthesize: async () => { throw new Error('402 insufficient_balance'); } };
    const { client, calls } = mockAnthropic([JSON.stringify(validScript)]);
    const service = makeService({ client, cache, tts: failingTts });

    await expect(service.getLesson({ topicId: topic.topic_id, language: 'uz' })).rejects.toThrow(/audio incomplete/);
    expect(calls).toHaveLength(2); // regenerated once before giving up
    // Nothing cached — a later request (once TTS recovers) regenerates cleanly.
    const { client: c2 } = mockAnthropic([JSON.stringify(validScript)]);
    const healed = createLessonService({
      anthropic: c2,
      models: { generation: 'claude-haiku-4-5', topicId: 'claude-sonnet-4-6' },
      content: fakeContent(),
      cache,
      tts: workingTts,
      db: fakeStorageDb(),
    });
    expect(await healed.getLesson({ topicId: topic.topic_id, language: 'uz' })).toMatchObject({ ok: true, cached: false });
  });

  it('treats a cached-but-audioless row as a miss and regenerates it (self-heal)', async () => {
    // validScript has a narration beat with no audio_url — a silently-degraded row.
    const poisoned = JSON.parse(JSON.stringify(validScript)) as BoardScript;
    const cache = fakeCache(poisoned);
    const { client, calls } = mockAnthropic([JSON.stringify(validScript)]);
    const service = makeService({ client, cache });

    const first = await service.getLesson({ topicId: topic.topic_id, language: 'uz' });
    expect(first).toMatchObject({ ok: true, cached: false }); // NOT served from the poisoned row
    expect(calls).toHaveLength(1);
    // The row is now healed (audio-complete) → the next request is a real cache hit.
    const second = await service.getLesson({ topicId: topic.topic_id, language: 'uz' });
    expect(second).toMatchObject({ ok: true, cached: true });
    expect(calls).toHaveLength(1);
  });

  it('with no TTS key, serves without ever caching an audioless lesson', async () => {
    const cache = fakeCache();
    const noTts = { enabled: false, synthesize: async () => Buffer.alloc(0) };
    const { client, calls } = mockAnthropic([JSON.stringify(validScript)]);
    const service = makeService({ client, cache, tts: noTts });

    expect(await service.getLesson({ topicId: topic.topic_id, language: 'uz' })).toMatchObject({ ok: true, cached: false });
    // Not cached → the second request regenerates rather than serving a silent row.
    expect(await service.getLesson({ topicId: topic.topic_id, language: 'uz' })).toMatchObject({ ok: true, cached: false });
    expect(calls).toHaveLength(2);
  });

  it('returns not_found for an unknown topic', async () => {
    const { client } = mockAnthropic([]);
    const service = makeService({ client });
    const res = await service.getLesson({ topicId: 'does_not_exist', language: 'en' });
    expect(res).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('wav helpers', () => {
  it('keeps short text as one chunk and splits long text within the character cap', () => {
    expect(chunkByChars('Short one.', 1000)).toEqual(['Short one.']);
    const long = 'Bu juda uzun gap. '.repeat(200);
    const chunks = chunkByChars(long, 1000);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1000);
  });

  it('gives Cyrillic the full character budget (counts chars, not utf-8 bytes)', () => {
    // 600 Cyrillic chars ≈ 1100+ utf-8 bytes — one chunk under a 1000-char cap,
    // but would have split under VoiceLab's old 1000-byte cap.
    const ru = 'Это предложение. '.repeat(40).slice(0, 600);
    expect(ru.length).toBe(600);
    expect(Buffer.byteLength(ru, 'utf8')).toBeGreaterThan(1000);
    expect(chunkByChars(ru, 1000)).toHaveLength(1);
  });

  it('concatenates WAV buffers into one with a summed data chunk', () => {
    const makeWav = (samples: number) => {
      const data = Buffer.alloc(samples * 2);
      const header = Buffer.alloc(44);
      header.write('RIFF', 0, 'ascii');
      header.writeUInt32LE(36 + data.length, 4);
      header.write('WAVE', 8, 'ascii');
      header.write('fmt ', 12, 'ascii');
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20);
      header.writeUInt16LE(1, 22);
      header.writeUInt32LE(24000, 24);
      header.writeUInt32LE(48000, 28);
      header.writeUInt16LE(2, 32);
      header.writeUInt16LE(16, 34);
      header.write('data', 36, 'ascii');
      header.writeUInt32LE(data.length, 40);
      return Buffer.concat([header, data]);
    };
    const merged = concatWav([makeWav(100), makeWav(150)]);
    const dataIdx = merged.indexOf('data', 12, 'ascii');
    expect(merged.readUInt32LE(dataIdx + 4)).toBe((100 + 150) * 2);
  });
});
