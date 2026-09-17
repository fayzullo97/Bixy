import 'dotenv/config';
import { env } from '../config/env.js';
import { createSupabase } from '../db/supabase.js';
import { createAisha } from '../modules/tts/aisha.js';
import { createOpenAiTts } from '../modules/tts/openai.js';
import { createTtsRouter } from '../modules/tts/router.js';
import { ensureNarrationBucket, uploadNarration } from '../modules/tts/audioStore.js';
import { narrate } from '../modules/tts/narrate.js';
import { GREETING_VARIANTS, greetingClipPath } from '../modules/tts/greetingClips.js';
import type { Language } from '../modules/generation/systemPrompt.js';

/**
 * One-off generator for the static greeting clips (Part 07 §12 step 2).
 *
 *   tsx src/scripts/gen-greeting-clips.ts [--lang en|uz|ru] [--dry-run]
 *   npm run gen-greeting-clips
 *
 * Runs every greeting variant through the real language router — so Uzbek goes
 * to Aisha (with the Biksy pronunciation fix) and English/Russian to OpenAI,
 * exactly like lesson narration — and uploads each one to a fixed path in the
 * narration bucket. Paths are stable, so re-running overwrites in place and the
 * URLs the client already holds keep working.
 *
 * Safe to re-run: it writes only under `greeting/`, touches no student data, and
 * uploads with upsert. Re-run it after editing any variant's text.
 */

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const langIndex = argv.indexOf('--lang');
const onlyLang = langIndex >= 0 ? (argv[langIndex + 1] as Language | undefined) : undefined;

const LANGUAGES: Language[] = ['en', 'uz', 'ru'];

async function main() {
  if (onlyLang && !LANGUAGES.includes(onlyLang)) {
    console.error(`--lang must be one of ${LANGUAGES.join(', ')}`);
    process.exit(1);
  }

  const db = createSupabase();
  const openai = createOpenAiTts({
    apiKey: env.OPENAI_API_KEY,
    baseUrl: env.OPENAI_BASE_URL,
    model: env.OPENAI_TTS_MODEL,
    voice: env.OPENAI_TTS_VOICE,
    instructions: env.OPENAI_TTS_INSTRUCTIONS || undefined,
  });
  const aisha = createAisha({
    apiKey: env.AISHA_API_KEY,
    baseUrl: env.AISHA_BASE_URL,
    mood: env.AISHA_MOOD,
  });
  const tts = createTtsRouter({ uz: aisha, ru: openai, en: openai });

  const targets = onlyLang ? [onlyLang] : LANGUAGES;
  console.log(`Target: ${env.SUPABASE_URL} / bucket "${env.NARRATION_BUCKET}"`);
  console.log(`Languages: ${targets.join(', ')}${dryRun ? '  (DRY RUN — nothing uploaded)' : ''}\n`);

  if (!dryRun) await ensureNarrationBucket(db);

  let generated = 0;
  let failed = 0;
  for (const language of targets) {
    for (const variant of GREETING_VARIANTS[language]) {
      const path = greetingClipPath(language, variant.id);
      if (dryRun) {
        console.log(`  [dry] ${path}\n        "${variant.text}"`);
        continue;
      }
      try {
        // Through `narrate` rather than raw `synthesize`, so the greeting gets
        // the same per-sentence splice as lesson narration and doesn't sound
        // like a different pipeline the moment it's more than one sentence.
        const result = await narrate(tts, variant.text, language);
        const url = await uploadNarration(db, path, result.wav);
        generated += 1;
        console.log(`  ok  ${path}  (${Math.round(result.duration_ms)}ms)\n      ${url}`);
      } catch (error) {
        failed += 1;
        console.error(`  FAIL ${path}: ${(error as Error).message}`);
      }
    }
  }

  console.log(`\n${generated} generated, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
