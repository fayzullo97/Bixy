import 'dotenv/config';
import { createSupabase } from '../db/supabase.js';

// DEV: delete result-cache rows so the next request regenerates from scratch
// (§9.2). Needed after a prompt change, or to re-run generation with TTS now that
// audio is available. Usage: tsx src/scripts/clear-lesson-cache.ts <topic_id> [lang]
const topic = process.argv[2];
const lang = process.argv[3];

async function main() {
  if (!topic) {
    console.error('usage: tsx src/scripts/clear-lesson-cache.ts <topic_id> [lang]');
    process.exit(1);
  }
  const db = createSupabase();
  let query = db.from('lesson_results').delete().eq('topic_id', topic);
  if (lang) query = query.eq('language', lang);
  const { data, error } = await query.select('topic_id, source, language');
  if (error) throw error;
  console.log(`deleted ${data?.length ?? 0} lesson_results row(s) for ${topic}${lang ? '/' + lang : ''}`);
  for (const row of data ?? []) console.log(`  - ${row.topic_id}/${row.source}/${row.language}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
