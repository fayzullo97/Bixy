import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSupabase } from './supabase';
import { parseTopic } from '../modules/content/topic';
import { parseDoodle, type DoodleRow } from '../modules/content/doodle';
import { supabaseContentRepo } from '../modules/content/content.repo';
import { parseLevelCheckQuestion } from '../modules/level-check/levelCheckQuestion';
import { supabaseLevelCheckRepo } from '../modules/level-check/levelCheck.repo';
import {
  DOODLE_BUCKET,
  ensureDoodleBucket,
  publicSvgUrl,
  uploadSvg,
} from '../modules/content/doodle-storage';

// server/src/db/seed.ts → repo root is three levels up.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const REFERENCE_MATERIAL = join(REPO_ROOT, 'reference-material.json');
const DOODLE_LIBRARY = join(REPO_ROOT, 'doodle-library.json');
const DOODLE_SVG_DIR = join(REPO_ROOT, 'Doodle Library');

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * Ingests the static content files into Supabase (§8.1, §9.1). Idempotent:
 * upserts rows and overwrites stored SVGs, so re-running converges to the same
 * state rather than duplicating. Row inserts + Storage uploads both go through
 * the service-role API — no direct Postgres connection needed here (only the
 * schema migration does).
 */
async function main() {
  const db = createSupabase();
  const repo = supabaseContentRepo(db);
  const levelCheck = supabaseLevelCheckRepo(db);

  // --- Reference material (topics) ---
  const reference = readJson(REFERENCE_MATERIAL) as {
    topics?: unknown;
    level_check_questions?: unknown;
  };
  if (!Array.isArray(reference.topics)) {
    throw new Error('reference-material.json: `topics` must be an array');
  }
  // sort_order = the topic's index in the file: the authored pedagogical order
  // the study plan (§8.12) walks families in. Re-runs are idempotent.
  const topics = reference.topics.map(parseTopic).map((t, i) => ({ ...t, sort_order: i }));
  console.log(`Parsed ${topics.length} topics — upserting...`);
  await repo.upsertTopics(topics);

  // --- Level-check question bank (§8.11) ---
  // Deferred from Phase 2 (table-per-phase); the FK to topics means this must
  // run after topics are upserted. Ingested here so the placement test has its
  // bank. Idempotent upsert keyed on the question id (= topic_id today).
  if (!Array.isArray(reference.level_check_questions)) {
    throw new Error('reference-material.json: `level_check_questions` must be an array');
  }
  const questions = reference.level_check_questions.map(parseLevelCheckQuestion);
  console.log(`Parsed ${questions.length} level-check questions — upserting...`);
  await levelCheck.upsertQuestions(questions);

  // --- Doodle library (metadata + SVG assets) ---
  const doodlesRaw = readJson(DOODLE_LIBRARY);
  if (!Array.isArray(doodlesRaw)) {
    throw new Error('doodle-library.json: expected a top-level array');
  }
  const doodles = doodlesRaw.map(parseDoodle);

  console.log(`Ensuring '${DOODLE_BUCKET}' storage bucket and uploading ${doodles.length} SVGs...`);
  await ensureDoodleBucket(db);
  const rows: DoodleRow[] = [];
  for (const doodle of doodles) {
    const path = `${doodle.id}.svg`;
    // readFileSync throws if the SVG is missing — a hard integrity check that
    // every catalog entry has its baked artwork before we record it.
    const svg = readFileSync(join(DOODLE_SVG_DIR, path));
    await uploadSvg(db, path, svg);
    rows.push({ ...doodle, svg_path: path });
  }
  await repo.upsertDoodles(rows);

  // --- Verify ---
  const [topicCount, doodleCount, liveQuestions] = await Promise.all([
    repo.countTopics(),
    repo.countDoodles(),
    levelCheck.listQuestions(),
  ]);
  console.log('\nDone. Live counts:');
  console.log(`  topics:                ${topicCount}`);
  console.log(`  doodle_elements:       ${doodleCount}`);
  console.log(`  level_check_questions: ${liveQuestions.length}`);
  const sample = rows[0];
  if (sample) console.log(`  sample SVG URL:  ${publicSvgUrl(db, sample.svg_path)}`);
}

main().catch((err) => {
  console.error('\nSeed failed:', err);
  process.exit(1);
});
