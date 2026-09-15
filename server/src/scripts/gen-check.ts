import 'dotenv/config';
import { env } from '../config/env.js';
import { createSupabase } from '../db/supabase.js';
import { supabaseContentRepo } from '../modules/content/content.repo.js';
import { anthropic, MODELS } from '../modules/generation/anthropic.js';
import { generateLesson } from '../modules/generation/generateLesson.js';
import { createAisha } from '../modules/tts/aisha.js';
import { createOpenAiTts } from '../modules/tts/openai.js';
import { createTtsRouter } from '../modules/tts/router.js';
import { ensureNarrationBucket, uploadNarration } from '../modules/tts/audioStore.js';
import { scriptLanguageIssue } from '../modules/generation/languageCheck.js';
import { contentLanguage } from '../modules/generation/contentLanguage.js';
import { spokenUnits } from '../modules/generation/spokenUnits.js';
import { isPlausibleWav } from '../modules/tts/wav.js';
import type { CheckInBeat, StoryBeat } from '../modules/generation/boardScript.js';

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

  // Same level gate the pipeline applies (Part 01 §1): a C1 topic generates
  // fully in English whatever was asked for, so check it against that.
  const effective = contentLanguage(topic.level, LANG);
  const gated = effective === LANG ? '' : ` → ${effective} (${topic.level} is English-only)`;
  console.log(`Generating "${TOPIC}" in ${LANG}${gated} with ${MODELS.generation}...`);
  const t0 = Date.now();
  const { script, attempts } = await generateLesson(
    { anthropic, model: MODELS.generation, doodles },
    { topic, language: effective },
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

  // Language sanity (§8.7, Part 01 §1): checked field by field — English-locked
  // fields English, localized fields in the effective content language.
  // generateLesson already enforces this and retries/throws, so a clean run here
  // just confirms the accepted script really matches the request.
  const langIssue = scriptLanguageIssue(script, effective);
  console.log(langIssue ? `⚠ language sanity: ${langIssue}` : `✓ language sanity OK (fields match ${effective})`);

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

  // The same language router the pipeline uses (Part 01 §2) — uz on Aisha,
  // ru/en on OpenAI — so this probes the provider that will actually serve.
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
  // Narration coverage (Part 02 §5): every beat now speaks, so report the split
  // rather than probing one story clip.
  const units = script.beats.flatMap((b) => spokenUnits(b, effective).map((u) => ({ beat: b.id, ...u })));
  const byLang = units.reduce<Record<string, number>>((acc, u) => {
    acc[u.language] = (acc[u.language] ?? 0) + 1;
    return acc;
  }, {});
  const silentBeats = script.beats.filter((b) => spokenUnits(b, effective).length === 0).map((b) => b.id);
  console.log(`spoken units=${units.length} ${JSON.stringify(byLang)}; silent beats=[${silentBeats}]`);
  console.log(`quiz_intro: ${JSON.stringify(script.quiz_intro?.slice(0, 90) ?? null)}`);

  const beat = stories[0];
  if (tts.enabled && beat) {
    try {
      await ensureNarrationBucket(db);
      // Probe one English-locked unit and one localized unit, so a mixed-language
      // beat is actually exercised across both providers.
      const probes = [units.find((u) => u.language === 'en'), units.find((u) => u.language !== 'en')].filter(
        (u): u is NonNullable<typeof u> => Boolean(u),
      );
      for (const u of probes) {
        const wav = await tts.synthesize(u.text, u.language);
        const url = await uploadNarration(db, `__gencheck__/${TOPIC}/${u.language}/beat_${u.beat}.wav`, wav);
        const check = await fetch(url);
        console.log(
          `✓ TTS [${u.language}] "${u.text.slice(0, 48)}…" → ${wav.length}B, ${check.status} ${check.headers.get('content-type')}, plausible=${isPlausibleWav(wav)}`,
        );
      }
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
