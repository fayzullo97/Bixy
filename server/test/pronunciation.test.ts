import { describe, expect, it } from 'vitest';
import { applyTtsPronunciation } from '../src/modules/tts/pronunciation.js';
import { createTtsRouter } from '../src/modules/tts/router.js';
import type { TtsClient } from '../src/modules/tts/client.js';

/** Records exactly what text reached the provider. */
function spyClient(): TtsClient & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    enabled: true,
    async synthesize(text: string) {
      calls.push(text);
      return Buffer.alloc(0);
    },
  };
}

describe('applyTtsPronunciation', () => {
  it('spells Bixy phonetically for Uzbek TTS', () => {
    expect(applyTtsPronunciation('Salom, men Bixy.', 'uz')).toBe('Salom, men Biksy.');
  });

  it('leaves every other language untouched', () => {
    expect(applyTtsPronunciation("Hi, I'm Bixy.", 'en')).toBe("Hi, I'm Bixy.");
    expect(applyTtsPronunciation('Я Бикси, а по-английски Bixy.', 'ru')).toBe(
      'Я Бикси, а по-английски Bixy.',
    );
  });

  it('matches any casing but always writes the proper-noun form', () => {
    expect(applyTtsPronunciation('bixy va BIXY', 'uz')).toBe('Biksy va Biksy');
  });

  it('leaves text with no occurrence alone', () => {
    expect(applyTtsPronunciation('Bugun darsni boshlaymiz.', 'uz')).toBe('Bugun darsni boshlaymiz.');
  });

  // Uzbek is agglutinative: case suffixes attach straight onto the noun. The
  // original rule anchored both ends (/\bbixy\b/) and so caught only the bare
  // name, sending every inflected form to the synthesizer unconverted.
  describe('declined forms — the whole paradigm converts', () => {
    it.each([
      ['Bixyman', 'Biksyman', 'first person — "I am Bixy"'],
      ['Bixyni', 'Biksyni', 'accusative'],
      ['Bixyga', 'Biksyga', 'dative'],
      ['Bixyning', 'Biksyning', 'genitive'],
      ['Bixyda', 'Biksyda', 'locative'],
      ['Bixydan', 'Biksydan', 'ablative'],
    ])('converts %s → %s (%s)', (input, expected) => {
      expect(applyTtsPronunciation(input, 'uz')).toBe(expected);
    });

    it('converts a declined form inside a real sentence', () => {
      expect(
        applyTtsPronunciation("Salom, Men Bixyman, sizga yordam beraman.", 'uz'),
      ).toBe('Salom, Men Biksyman, sizga yordam beraman.');
    });
  });

  it('still refuses to match inside a longer word — the leading \\b is load-bearing', () => {
    // No word boundary before "bixy" here, so the rule does not fire.
    expect(applyTtsPronunciation('mybixy', 'uz')).toBe('mybixy');
    expect(applyTtsPronunciation('abixyda', 'uz')).toBe('abixyda');
  });

  it('DOES convert a word-initial compound — the accepted cost of dropping the trailing anchor', () => {
    // "Bixyland" starts at a word boundary, so it is indistinguishable from a
    // suffixed form by shape alone and converts too. Documented rather than
    // asserted away: a regex cannot separate "Bixy + suffix" from "Bixy +
    // compound", and no such compound exists in this product's vocabulary. If
    // one ever does, the fix is a suffix allowlist, not re-adding the anchor —
    // re-adding it would break the entire paradigm above.
    expect(applyTtsPronunciation('Bixyland', 'uz')).toBe('Biksyland');
  });
});

describe('TTS router applies pronunciation at the provider boundary', () => {
  it('sends Biksy to the Uzbek provider', async () => {
    const uz = spyClient();
    const other = spyClient();
    const router = createTtsRouter({ uz, ru: other, en: other });

    await router.synthesize('Men Bixy.', 'uz');
    expect(uz.calls).toEqual(['Men Biksy.']);
  });

  it('sends the display spelling to the English and Russian provider', async () => {
    const uz = spyClient();
    const openai = spyClient();
    const router = createTtsRouter({ uz, ru: openai, en: openai });

    await router.synthesize("I'm Bixy.", 'en');
    await router.synthesize('Это Bixy.', 'ru');
    expect(openai.calls).toEqual(["I'm Bixy.", 'Это Bixy.']);
  });
});
