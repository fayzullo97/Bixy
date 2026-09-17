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

  it('does not touch the name inside a longer word', () => {
    expect(applyTtsPronunciation('Bixyland', 'uz')).toBe('Bixyland');
  });

  it('leaves text with no occurrence alone', () => {
    expect(applyTtsPronunciation("Bugun darsni boshlaymiz.", 'uz')).toBe(
      'Bugun darsni boshlaymiz.',
    );
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
