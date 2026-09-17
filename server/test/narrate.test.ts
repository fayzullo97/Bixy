import { describe, expect, it, vi } from 'vitest';
import { narrate, SENTENCE_GAP_MS } from '../src/modules/tts/narrate';
import { readWavFormat, silenceWav, splitSentences, wavDurationMs } from '../src/modules/tts/wav';
import type { TtsClient } from '../src/modules/tts/client';

/** PCM16 mono 24kHz WAV of a given duration. */
function wavOfMs(ms: number): Buffer {
  const bytes = Math.round((ms / 1000) * 24000 * 2);
  const data = Buffer.alloc(bytes);
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

/** Speaks each sentence as a clip whose length scales with its character count. */
function fakeTts(msPerChar = 50) {
  const calls: string[] = [];
  const client: TtsClient = {
    enabled: true,
    async synthesize(text) {
      calls.push(text);
      return wavOfMs(text.length * msPerChar);
    },
  };
  return { client, calls };
}

describe('splitSentences (Part 02 §3)', () => {
  it('splits on sentence boundaries', () => {
    expect(splitSentences('One thing. Two things! Three?')).toEqual(['One thing.', 'Two things!', 'Three?']);
  });

  it('keeps a short filler interjection as its own sentence', () => {
    // The 400ms gap AFTER "Hmm..." is the thinking pause — merging it into the
    // next sentence would synthesize one continuous breath and lose the effect.
    expect(splitSentences("Hmm... Xo'p, mayli. Keling boshlaymiz.")).toEqual([
      'Hmm...',
      "Xo'p, mayli.",
      'Keling boshlaymiz.',
    ]);
  });

  it('returns the whole text when there is no terminal punctuation', () => {
    expect(splitSentences('Present Perfect')).toEqual(['Present Perfect']);
  });

  it('returns nothing for empty text', () => {
    expect(splitSentences('   ')).toEqual([]);
  });
});

describe('silenceWav / wavDurationMs', () => {
  it('generates silence of the requested length in the clip’s own format', () => {
    const format = readWavFormat(wavOfMs(1000));
    const gap = silenceWav(400, format);
    expect(wavDurationMs(gap)).toBe(400);
    expect(readWavFormat(gap)).toEqual(format);
  });

  it('measures a clip’s duration from its PCM data', () => {
    expect(wavDurationMs(wavOfMs(1500))).toBe(1500);
  });
});

describe('narrate — per-sentence synthesis + 400ms splice', () => {
  it('synthesizes one clip per sentence, not one per unit', async () => {
    const { client, calls } = fakeTts();
    await narrate(client, 'First sentence. Second sentence.', 'en');
    expect(calls).toEqual(['First sentence.', 'Second sentence.']);
  });

  it('joins clips with exactly one 400ms gap between them', async () => {
    const { client } = fakeTts();
    const a = 'First sentence.'.length * 50;
    const b = 'Second one.'.length * 50;
    const result = await narrate(client, 'First sentence. Second one.', 'en');

    // Total = both clips + one gap. Two sentences means one gap, not two.
    expect(result.duration_ms).toBe(a + SENTENCE_GAP_MS + b);
    expect(wavDurationMs(result.wav)).toBe(result.duration_ms);
  });

  it('reports each sentence’s exact duration and offset', async () => {
    const { client } = fakeTts();
    const result = await narrate(client, 'Aaa. Bb. C.', 'en');
    const [s0, s1, s2] = result.sentences;

    expect(s0!.start_ms).toBe(0);
    // Each offset is the previous sentence's end plus the gap — these are the
    // exact numbers the proportional-timing subtitle fallback distributes over.
    expect(s1!.start_ms).toBe(s0!.duration_ms + SENTENCE_GAP_MS);
    expect(s2!.start_ms).toBe(s1!.start_ms + s1!.duration_ms + SENTENCE_GAP_MS);
    expect(result.sentences.map((s) => s.text)).toEqual(['Aaa.', 'Bb.', 'C.']);
  });

  it('adds no gap to a single-sentence unit', async () => {
    const { client } = fakeTts();
    const result = await narrate(client, 'Just the one.', 'en');
    expect(result.duration_ms).toBe('Just the one.'.length * 50);
    expect(result.sentences).toHaveLength(1);
  });

  it('routes every sentence through the language it was given', async () => {
    const synthesize = vi.fn(async (_text: string, _language: string) => wavOfMs(100));
    await narrate({ enabled: true, synthesize }, 'Один. Два.', 'ru');
    expect(synthesize).toHaveBeenCalledTimes(2);
    for (const call of synthesize.mock.calls) expect(call[1]).toBe('ru');
  });

  it('throws rather than returning an empty clip for empty text', async () => {
    const { client } = fakeTts();
    await expect(narrate(client, '   ', 'en')).rejects.toThrow(/nothing to say/);
  });
});
