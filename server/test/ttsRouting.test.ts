import { afterEach, describe, expect, it, vi } from 'vitest';
import { createOpenAiTts } from '../src/modules/tts/openai';
import { createTtsRouter } from '../src/modules/tts/router';
import { isPlausibleWav, normalizeWav } from '../src/modules/tts/wav';
import type { TtsClient } from '../src/modules/tts/client';

const config = {
  apiKey: 'sk-test',
  baseUrl: 'https://api.openai.com',
  model: 'gpt-4o-mini-tts',
  voice: 'alloy',
};

/** Minimal valid PCM16 mono 24kHz WAV, matching what the API returns for wav. */
function makeWav(dataBytes = 32): Buffer {
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

/** A streamed WAV: RIFF and `data` sizes are 0xFFFFFFFF placeholders. */
function makeStreamedWav(dataBytes = 32): Buffer {
  const wav = makeWav(dataBytes);
  wav.writeUInt32LE(0xffffffff, 4);
  wav.writeUInt32LE(0xffffffff, wav.indexOf('data', 12, 'ascii') + 4);
  return wav;
}

type PostResult = { kind: 'ok' } | { kind: 'streamed' } | { kind: 'garbage' } | { kind: 'err'; status: number; body: string };

/** Stubs global.fetch for /v1/audio/speech, recording each request's JSON body. */
function stubFetch(post: () => PostResult) {
  const posts: Array<{ body: Record<string, unknown>; headers: Record<string, string> }> = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    expect(String(url)).toBe('https://api.openai.com/v1/audio/speech');
    posts.push({
      body: JSON.parse(init.body as string),
      headers: init.headers as Record<string, string>,
    });
    const r = post();
    if (r.kind === 'err') {
      return { ok: false, status: r.status, text: async () => r.body } as unknown as Response;
    }
    const bytes =
      r.kind === 'garbage'
        ? new TextEncoder().encode('{"error":"nope"}')
        : new Uint8Array(r.kind === 'streamed' ? makeStreamedWav() : makeWav());
    return { ok: true, status: 200, arrayBuffer: async () => bytes.buffer } as unknown as Response;
  });
  vi.stubGlobal('fetch', fn);
  return { fn, posts };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('OpenAI TTS client', () => {
  it('is disabled without an API key', () => {
    expect(createOpenAiTts({ ...config, apiKey: '' }).enabled).toBe(false);
    expect(createOpenAiTts(config).enabled).toBe(true);
  });

  it('requests WAV (not the mp3 default) so the storage path stays unchanged', async () => {
    const { posts } = stubFetch(() => ({ kind: 'ok' }));
    const wav = await createOpenAiTts(config).synthesize('Hello there.', 'en');

    expect(posts).toHaveLength(1);
    const { body, headers } = posts[0]!;
    expect(headers.Authorization).toBe('Bearer sk-test');
    expect(body.response_format).toBe('wav');
    expect(body.model).toBe('gpt-4o-mini-tts');
    expect(body.voice).toBe('alloy');
    expect(body.input).toBe('Hello there.');
    expect(isPlausibleWav(wav)).toBe(true);
  });

  it('sends no language parameter — one voice handles ru+en code-switching', async () => {
    const { posts } = stubFetch(() => ({ kind: 'ok' }));
    const client = createOpenAiTts(config);
    await client.synthesize('Это Present Perfect.', 'ru');
    await client.synthesize('This is Present Perfect.', 'en');

    expect(posts).toHaveLength(2);
    for (const { body } of posts) {
      expect(body).not.toHaveProperty('language');
      // Identical voice across both languages — that's the no-seam guarantee.
      expect(body.voice).toBe('alloy');
    }
  });

  it('omits `instructions` unless configured', async () => {
    const { posts } = stubFetch(() => ({ kind: 'ok' }));
    await createOpenAiTts(config).synthesize('x', 'en');
    expect(posts[0]!.body).not.toHaveProperty('instructions');

    vi.unstubAllGlobals();
    const second = stubFetch(() => ({ kind: 'ok' }));
    await createOpenAiTts({ ...config, instructions: 'Speak warmly.' }).synthesize('x', 'en');
    expect(second.posts[0]!.body.instructions).toBe('Speak warmly.');
  });

  it('400 is terminal — thrown, not retried', async () => {
    const { fn } = stubFetch(() => ({ kind: 'err', status: 400, body: '{"error":"bad input"}' }));
    await expect(createOpenAiTts(config).synthesize('x', 'en')).rejects.toThrow(/400/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('401 is terminal — a bad key cannot succeed on retry', async () => {
    const { fn } = stubFetch(() => ({ kind: 'err', status: 401, body: 'invalid_api_key' }));
    await expect(createOpenAiTts(config).synthesize('x', 'en')).rejects.toThrow(/401/);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('429 is retried, then thrown', { timeout: 15000 }, async () => {
    const { fn } = stubFetch(() => ({ kind: 'err', status: 429, body: 'rate limited' }));
    await expect(createOpenAiTts(config).synthesize('x', 'en')).rejects.toThrow(/OpenAI TTS failed: 429/);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('treats a 200 that is not a WAV as a failure and retries (§8.10)', { timeout: 15000 }, async () => {
    const { fn } = stubFetch(() => ({ kind: 'garbage' }));
    await expect(createOpenAiTts(config).synthesize('x', 'en')).rejects.toThrow(/non-WAV data/);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('normalizes the streamed WAV the API actually returns (0xFFFFFFFF sizes)', async () => {
    // Verified live 2026-09-15: /v1/audio/speech streams its wav, so both the
    // RIFF size and the `data` chunk size arrive as "length unknown"
    // placeholders. Stored unchanged they fail isPlausibleWav and players
    // disagree on them, so the client rewrites them with the real byte counts.
    const { fn } = stubFetch(() => ({ kind: 'streamed' }));
    const wav = await createOpenAiTts(config).synthesize('Hello there.', 'en');

    expect(fn).toHaveBeenCalledTimes(1); // accepted first time, not retried
    expect(isPlausibleWav(wav)).toBe(true);
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
    expect(wav.readUInt32LE(wav.indexOf('data', 12, 'ascii') + 4)).toBe(32);
  });

  it('splits >4096-char input across requests and rejoins the WAVs', async () => {
    const { posts } = stubFetch(() => ({ kind: 'ok' }));
    const long = 'This is a sentence. '.repeat(400); // 8000 chars
    const wav = await createOpenAiTts(config).synthesize(long, 'en');

    expect(posts.length).toBeGreaterThan(1);
    for (const { body } of posts) expect((body.input as string).length).toBeLessThanOrEqual(4096);
    expect(wav.length).toBe(44 + posts.length * 32);
  });
});

/** A stand-in provider that records what it was asked to speak. */
function fakeProvider(name: string, enabled = true) {
  const calls: Array<{ text: string; language: string }> = [];
  const client: TtsClient = {
    enabled,
    async synthesize(text, language) {
      calls.push({ text, language });
      return Buffer.from(name);
    },
  };
  return { client, calls };
}

describe('TTS router (Part 01 §2 language split)', () => {
  it('routes uz to Aisha and ru/en to OpenAI', async () => {
    const aisha = fakeProvider('aisha');
    const openai = fakeProvider('openai');
    const router = createTtsRouter({ uz: aisha.client, ru: openai.client, en: openai.client });

    expect((await router.synthesize('Salom.', 'uz')).toString()).toBe('aisha');
    expect((await router.synthesize('Привет.', 'ru')).toString()).toBe('openai');
    expect((await router.synthesize('Hello.', 'en')).toString()).toBe('openai');

    expect(aisha.calls).toEqual([{ text: 'Salom.', language: 'uz' }]);
    expect(openai.calls).toEqual([
      { text: 'Привет.', language: 'ru' },
      { text: 'Hello.', language: 'en' },
    ]);
  });

  it('is enabled when any provider has a key, disabled when none do', () => {
    const on = fakeProvider('on').client;
    const off = fakeProvider('off', false).client;
    expect(createTtsRouter({ uz: on, ru: off, en: off }).enabled).toBe(true);
    expect(createTtsRouter({ uz: off, ru: off, en: off }).enabled).toBe(false);
  });

  it('throws for a language whose provider has no key, rather than returning silence', async () => {
    const aisha = fakeProvider('aisha');
    const openai = fakeProvider('openai', false);
    const router = createTtsRouter({ uz: aisha.client, ru: openai.client, en: openai.client });

    // Uzbek still works — a partial configuration narrates what it can.
    expect((await router.synthesize('Salom.', 'uz')).toString()).toBe('aisha');
    // Russian fails loudly; the pipeline's narrationComplete gate then fails the
    // whole lesson instead of serving it half-silent (§8.10).
    await expect(router.synthesize('Привет.', 'ru')).rejects.toThrow(/missing its API key/);
    expect(openai.calls).toHaveLength(0);
  });

  it('throws for an unknown language instead of picking a default provider', async () => {
    const p = fakeProvider('p');
    const router = createTtsRouter({ uz: p.client, ru: p.client, en: p.client });
    await expect(router.synthesize('x', 'de' as never)).rejects.toThrow(/no provider configured/);
  });
});

describe('normalizeWav', () => {
  it('leaves a canonical WAV untouched', () => {
    const wav = makeWav(32);
    expect(normalizeWav(wav).equals(wav)).toBe(true);
  });

  it('rewrites placeholder sizes with the real byte counts', () => {
    const fixed = normalizeWav(makeStreamedWav(32));
    expect(isPlausibleWav(fixed)).toBe(true);
    expect(fixed.readUInt32LE(4)).toBe(fixed.length - 8);
  });

  it('passes through non-WAV bytes rather than corrupting them', () => {
    const junk = Buffer.from('<html>error</html>'.repeat(4));
    expect(normalizeWav(junk).equals(junk)).toBe(true);
  });
});
