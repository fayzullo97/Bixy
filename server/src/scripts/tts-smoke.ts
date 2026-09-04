import 'dotenv/config';
import { env } from '../config/env.js';
import { createSupabase } from '../db/supabase.js';
import { createAisha } from '../modules/tts/aisha.js';
import { ensureNarrationBucket, uploadNarration } from '../modules/tts/audioStore.js';

// Cheap live end-to-end check for the TTS wiring only (no Claude call): real
// Aisha client → our narration bucket → our public URL, one short beat per
// language. Uploads under a __smoke__/ prefix so it never collides with lessons.
// Usage: tsx src/scripts/tts-smoke.ts
const SENTENCES: Record<'uz' | 'en' | 'ru', string> = {
  uz: 'Salom, bu qisqa sinov.',
  en: 'Hello, this is a short test.',
  ru: 'Привет, это короткий тест.',
};

async function main() {
  const db = createSupabase();
  const tts = createAisha({
    apiKey: env.AISHA_API_KEY,
    baseUrl: env.AISHA_BASE_URL,
    mood: env.AISHA_MOOD,
  });
  if (!tts.enabled) throw new Error('AISHA_API_KEY is not set — cannot smoke TTS.');
  await ensureNarrationBucket(db);

  for (const lang of ['uz', 'en', 'ru'] as const) {
    const text = SENTENCES[lang];
    try {
      const t0 = Date.now();
      const wav = await tts.synthesize(text, lang);
      const url = await uploadNarration(db, `__smoke__/${lang}/beat.wav`, wav);
      const check = await fetch(url);
      console.log(
        `✓ ${lang}: "${text}" (${text.length} chars) → ${wav.length}B in ${Date.now() - t0}ms → our bucket ${check.status} ${check.headers.get('content-type')}`,
      );
      console.log(`   ${url}`);
    } catch (e) {
      console.log(`✗ ${lang}: FAILED — ${(e as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error('tts-smoke failed:', e);
  process.exit(1);
});
