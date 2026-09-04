import 'dotenv/config';
import { env } from '../config/env';
import { createSupabase } from '../db/supabase';
import { supabaseContentRepo } from '../modules/content/content.repo';
import { anthropic, MODELS } from '../modules/generation/anthropic';
import { generateLesson } from '../modules/generation/generateLesson';
import { createAisha } from '../modules/tts/aisha';
import { ensureNarrationBucket, uploadNarration } from '../modules/tts/audioStore';
import { scriptLanguageIssue } from '../modules/generation/languageCheck';
import { isPlausibleWav } from '../modules/tts/wav';
import type { CheckInBeat, StoryBeat } from '../modules/generation/boardScript';

// Live end-to-end check for the generation pipeline (real Claude + Aisha TTS).
// Usage: tsx src/scripts/gen-check.ts [topic_id] [language]
const TOPIC = process.argv[2] ?? 'present_perfect_tense';
const LANG = (process.argv[3] ?? 'uz') as 'en' | 'uz' | 'ru';

async function main() {
  const db = createSupabase();
  const content = supabaseContentRepo(db);

  const topic = await content.getTopic(TOPIC);
  if (!topic) throw new Error(`topic "${TOPIC}" not found`);
  const doodles = await content.listDoodles();

  console.log(`Generating "${TOPIC}" in ${LANG} with ${MODELS.generation}...`);
  const t0 = Date.now();
  const { script, attempts } = await generateLesson(
    { anthropic, model: MODELS.generation, doodles },
    { topic, language: LANG },
  );
  console.log(`✓ generated in ${Date.now() - t0}ms (attempts=${attempts}, beats=${script.beats.length})`);
  console.log(
    'arc:',
    script.beats.map((b) => (b.type === 'story_beat' ? 'story' : b.style)).join(' → '),
  );

  const stories = script.beats.filter((b): b is StoryBeat => b.type === 'story_beat');
  const checkins = script.beats.filter(
    (b): b is CheckInBeat => b.type === 'formal_beat' && b.style === 'check_in_question',
  );
  const reactionsOk = checkins.every(
    (c) => c.wrong_answer_reactions && Object.keys(c.wrong_answer_reactions).length > 0,
  );
  console.log(`story beats=${stories.length}, check-ins=${checkins.length}, all have wrong_answer_reactions=${reactionsOk}`);
  console.log('sample narration:', JSON.stringify(stories[0]?.narration.slice(0, 140)));

  // Language sanity (§8.7): narration in the requested language, board text English.
  // generateLesson already enforces this and retries/throws, so a clean run here
  // just confirms the accepted script really matches the request.
  const langIssue = scriptLanguageIssue(script, LANG);
  console.log(langIssue ? `⚠ language sanity: ${langIssue}` : `✓ language sanity OK (narration matches ${LANG})`);

  // Quiz sanity (§8.4): count in range, types blended, every tag resolves to a beat.
  const quiz = script.quiz ?? [];
  const beatIds = new Set(script.beats.map((b) => b.id));
  const byType = quiz.reduce<Record<string, number>>((acc, q) => {
    acc[q.type] = (acc[q.type] ?? 0) + 1;
    return acc;
  }, {});
  const tagsOk = quiz.every((q) => beatIds.has(q.tests_beat_id));
  const blended = Object.keys(byType).length >= 2;
  console.log(
    `quiz: ${quiz.length} questions ${JSON.stringify(byType)} — blended=${blended}, all tests_beat_id resolve=${tagsOk}`,
  );

  const tts = createAisha({
    apiKey: env.AISHA_API_KEY,
    baseUrl: env.AISHA_BASE_URL,
    mood: env.AISHA_MOOD,
  });
  const beat = stories[0];
  if (tts.enabled && beat) {
    try {
      await ensureNarrationBucket(db);
      const wav = await tts.synthesize(beat.narration, LANG);
      const url = await uploadNarration(db, `${TOPIC}/${LANG}/reference_material/beat_${beat.id}.wav`, wav);
      const check = await fetch(url);
      console.log(`✓ TTS ${wav.length} bytes → ${check.status} ${check.headers.get('content-type')}`);
      console.log(`  plausible WAV=${isPlausibleWav(wav)}  ${url}`);
    } catch (err) {
      console.log(`⚠ TTS unavailable (transient): ${(err as Error).message}`);
    }
  } else {
    console.log('TTS disabled (no key).');
  }
}

main().catch((err) => {
  console.error('gen-check failed:', err);
  process.exit(1);
});
