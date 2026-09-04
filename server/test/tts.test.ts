import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAisha } from '../src/modules/tts/aisha';
import { isPlausibleWav } from '../src/modules/tts/wav';

const config = { apiKey: 'k-123', baseUrl: 'https://back.aisha.group', mood: 'Neutral' };

/** Minimal valid PCM16 mono 24kHz WAV so concatWav can rejoin chunked results. */
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

function audioResponse() {
  const wav = makeWav();
  return { ok: true, status: 200, arrayBuffer: async () => new Uint8Array(wav).buffer } as unknown as Response;
}

type PostResult =
  | { kind: 'ok'; audioPath?: string }
  | { kind: 'err'; status: number; body: string };

/** Stubs global.fetch, recording each POST's FormData + headers. */
function stubFetch(post: () => PostResult) {
  const posts: Array<{ body: FormData; headers: Record<string, string> }> = [];
  const fn = vi.fn(async (url: string, init: RequestInit) => {
    if (String(url).endsWith('/api/v1/tts/post/')) {
      posts.push({ body: init.body as FormData, headers: init.headers as Record<string, string> });
      const r = post();
      if (r.kind === 'ok') {
        return {
          ok: true,
          status: 201,
          json: async () => ({ audio_path: r.audioPath ?? 'https://cdn.aisha.group/x.wav' }),
        } as unknown as Response;
      }
      return { ok: false, status: r.status, text: async () => r.body } as unknown as Response;
    }
    return audioResponse();
  });
  vi.stubGlobal('fetch', fn);
  return { fn, posts };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Aisha TTS client', () => {
  it('is disabled without an API key', () => {
    expect(createAisha({ ...config, apiKey: '' }).enabled).toBe(false);
    expect(createAisha(config).enabled).toBe(true);
  });

  it('uz: sends model/mood/speed and the X-Api-Key header, returns the fetched WAV', async () => {
    const { posts } = stubFetch(() => ({ kind: 'ok' }));
    const wav = await createAisha(config).synthesize('Salom dunyo.', 'uz');

    expect(posts).toHaveLength(1);
    const { body, headers } = posts[0]!;
    expect(headers['X-Api-Key']).toBe('k-123');
    expect(body.get('transcript')).toBe('Salom dunyo.');
    expect(body.get('language')).toBe('uz');
    expect(body.get('model')).toBe('Gulnoza');
    expect(body.get('mood')).toBe('Neutral');
    expect(body.get('speed')).toBe('1.0');
    expect(wav.equals(makeWav())).toBe(true);
  });

  it('en/ru: omit model/mood/speed (different path per API contract)', async () => {
    const { posts } = stubFetch(() => ({ kind: 'ok' }));
    await createAisha(config).synthesize('Hello world.', 'en');
    await createAisha(config).synthesize('Привет мир.', 'ru');

    for (const { body } of posts) {
      expect(body.get('model')).toBeNull();
      expect(body.get('mood')).toBeNull();
      expect(body.get('speed')).toBeNull();
    }
    expect(posts[0]!.body.get('language')).toBe('en');
    expect(posts[1]!.body.get('language')).toBe('ru');
  });

  it('splits >1000-char text into multiple requests and rejoins the WAVs', async () => {
    const { posts } = stubFetch(() => ({ kind: 'ok' }));
    const long = 'This is a sentence. '.repeat(120); // 2400 chars
    const wav = await createAisha(config).synthesize(long, 'en');

    expect(posts.length).toBeGreaterThan(1);
    for (const { body } of posts) expect((body.get('transcript') as string).length).toBeLessThanOrEqual(1000);
    // Two 32-byte data chunks rejoined → 44-byte header + summed data.
    expect(wav.length).toBe(44 + posts.length * 32);
  });

  it('402 insufficient_balance is terminal — thrown, not retried', async () => {
    const { fn } = stubFetch(() => ({ kind: 'err', status: 402, body: '{"error_key":"insufficient_balance"}' }));
    await expect(createAisha(config).synthesize('x', 'uz')).rejects.toThrow(/402/);
    expect(fn).toHaveBeenCalledTimes(1); // no retry
  });

  it('503 is retried, then thrown', { timeout: 15000 }, async () => {
    const { fn } = stubFetch(() => ({ kind: 'err', status: 503, body: 'unavailable' }));
    await expect(createAisha(config).synthesize('x', 'uz')).rejects.toThrow(/Aisha TTS failed: 503/);
    expect(fn).toHaveBeenCalledTimes(3); // 3 attempts
  });
});

/** POST always returns 201 + audio_path; the audio GET is driven by a sequence. */
function stubPostThenAudio(audioSeq: Array<() => Response | null>) {
  let audioI = 0;
  const fn = vi.fn(async (url: string) => {
    if (String(url).endsWith('/api/v1/tts/post/')) {
      return {
        ok: true,
        status: 201,
        json: async () => ({ audio_path: 'https://cdn.aisha.group/x.wav' }),
      } as unknown as Response;
    }
    const make = audioSeq[Math.min(audioI, audioSeq.length - 1)]!;
    audioI += 1;
    const r = make();
    if (r === null) throw new Error('network down'); // a rejected fetch
    return r;
  });
  vi.stubGlobal('fetch', fn);
  return { fn };
}

describe('isPlausibleWav', () => {
  it('accepts a canonical WAV with a non-empty data chunk', () => {
    expect(isPlausibleWav(makeWav(32))).toBe(true);
  });

  it('rejects an empty or too-short buffer', () => {
    expect(isPlausibleWav(Buffer.alloc(0))).toBe(false);
    expect(isPlausibleWav(Buffer.alloc(10))).toBe(false);
  });

  it('rejects a 200 body that is not a WAV (e.g. an HTML error page)', () => {
    expect(isPlausibleWav(Buffer.from('<html>error</html>'.repeat(4)))).toBe(false);
  });

  it('rejects a WAV whose data chunk is zero-length', () => {
    expect(isPlausibleWav(makeWav(0))).toBe(false);
  });
});

describe('Aisha audio_path resilience (§8.10 TTS)', () => {
  it('retries the synth when the audio_path is unreachable, then succeeds', { timeout: 15000 }, async () => {
    const notFound = { ok: false, status: 404 } as unknown as Response;
    const { fn } = stubPostThenAudio([() => null, () => notFound, () => audioResponse()]);
    const wav = await createAisha(config).synthesize('Salom dunyo.', 'uz');
    expect(isPlausibleWav(wav)).toBe(true);
    // 3 attempts, each a POST + an audio GET (rejected → 404 → ok).
    expect(fn).toHaveBeenCalledTimes(6);
  });

  it('treats a 200 that is not a WAV as a failure and retries, then throws', { timeout: 15000 }, async () => {
    const garbage = {
      ok: true,
      status: 200,
      arrayBuffer: async () => new TextEncoder().encode('<html>error</html>').buffer,
    } as unknown as Response;
    const { fn } = stubPostThenAudio([() => garbage]);
    await expect(createAisha(config).synthesize('Salom dunyo.', 'uz')).rejects.toThrow(/non-WAV data/);
    expect(fn).toHaveBeenCalledTimes(6); // 3 × (POST + audio GET)
  });
});
