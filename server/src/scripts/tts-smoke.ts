import 'dotenv/config';
import { env } from '../config/env.js';
import { createSupabase } from '../db/supabase.js';
import { createAisha } from '../modules/tts/aisha.js';
import { createOpenAiTts } from '../modules/tts/openai.js';
import { createTtsRouter } from '../modules/tts/router.js';
import { ensureNarrationBucket, uploadNarration } from '../modules/tts/audioStore.js';
import type { Language } from '../modules/generation/systemPrompt.js';

// Cheap live end-to-end check for the TTS wiring only (no Claude call): the real
// language router → the right provider → our narration bucket → our public URL.
// Uploads under a __smoke__/ prefix so it never collides with lessons.
// Usage: tsx src/scripts/tts-smoke.ts
//
// `ru_mixed` is the case Part 01 §2 rests on: a Russian narration carrying
// embedded English grammar terms, which must come back in ONE voice with no
// accent on the English. Listen to that one — it can't be asserted from bytes.
const CASES: Array<{ label: string; language: Language; text: string }> = [
  { label: 'uz', language: 'uz', text: 'Salom, bu qisqa sinov.' },
  { label: 'en', language: 'en', text: 'Hello, this is a short test.' },
  { label: 'ru', language: 'ru', text: 'Привет, это короткий тест.' },
  {
    label: 'ru_mixed',
    language: 'ru',
    text: 'Это время называется Present Perfect — оно связывает прошлое с настоящим, например: I have visited Samarkand.',
  },
];

const PROVIDER: Record<Language, string> = { uz: 'aisha', ru: 'openai', en: 'openai' };

async function main() {
  const db = createSupabase();
  const openai = createOpenAiTts({
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL,
    model: env.OPENAI_TTS_MODEL,
    voice: env.OPENAI_TTS_VOICE,
    instructions: env.OPENAI_TTS_INSTRUCTIONS || undefined,
  });
  const tts = createTtsRouter({
    uz: createAisha({
      apiKey: env.AISHA_API_KEY,
      baseUrl: env.AISHA_BASE_URL,
      mood: env.AISHA_MOOD,
    }),
    ru: openai,
    en: openai,
  });

  if (!tts.enabled) throw new Error('No TTS key set (AISHA_API_KEY / OPENAI_API_KEY) — cannot smoke TTS.');
  if (!env.AISHA_API_KEY) console.log('! AISHA_API_KEY unset — uz is expected to fail.');
  if (!env.OPENAI_API_KEY) console.log('! OPENAI_API_KEY unset — en/ru are expected to fail.');
  await ensureNarrationBucket(db);

  for (const { label, language, text } of CASES) {
    try {
      const t0 = Date.now();
      const wav = await tts.synthesize(text, language);
      const url = await uploadNarration(db, `__smoke__/${label}/beat.wav`, wav);
      const check = await fetch(url);
      console.log(
        `✓ ${label} [${PROVIDER[language]}]: "${text}" (${text.length} chars) → ${wav.length}B in ${Date.now() - t0}ms → our bucket ${check.status} ${check.headers.get('content-type')}`,
      );
      console.log(`   ${url}`);
    } catch (e) {
      console.log(`✗ ${label} [${PROVIDER[language]}]: FAILED — ${(e as Error).message}`);
    }
  }
}

main().catch((e) => {
  console.error('tts-smoke failed:', e);
  process.exit(1);
});
