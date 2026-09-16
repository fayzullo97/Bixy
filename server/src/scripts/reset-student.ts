import 'dotenv/config';
import { createInterface } from 'node:readline/promises';
import { createSupabase } from '../db/supabase.js';
import { env } from '../config/env.js';

/**
 * DEV: put one student back to a brand-new account so the onboarding flow can be
 * re-tested on the same Telegram id instead of needing a fresh account each time.
 *
 *   tsx src/scripts/reset-student.ts <telegram_id> [--dry-run] [--yes]
 *   npm run reset-student -- <telegram_id> [--dry-run] [--yes]
 *
 * What a reset student sees on the next load: no plan, so Part 07 §12 runs from
 * the top (greeting → level check → language → reveal → home), then Part 05 §7's
 * first meeting on the board, then a `full` greeting after it.
 *
 * This is a PROGRESS reset, not an account wipe. The users row survives with
 * every identity and preference field intact — name, username, photo_url,
 * app_language, created_at — because the point is to retest the flow AS this
 * student, not to become a different one. Only the two "have we done this yet"
 * stamps are cleared.
 *
 * It is destructive and it runs against whatever SUPABASE_URL the environment
 * points at, which in this project is production. Hence: it names the target
 * host and the exact row counts up front, and will not delete anything without
 * either an interactive "yes" or --yes.
 */

/**
 * The per-student tables. Every one references users(telegram_id) directly
 * (migrations 0001, 0004, 0005) and NONE references another, so there is no FK
 * ordering constraint between them — but they are still emptied before the users
 * row is touched, so an interrupted run can only ever leave a student with MORE
 * progress than intended, never a users row pointing at rows that outlived it.
 *
 * `level_check_seen` is in here because the level check excludes already-seen
 * questions (`levelCheck.repo.ts` → `listSeen`). Leaving it would let the test
 * re-run against a depleted question pool, which is not what a new student gets.
 */
const PROGRESS_TABLES = ['progress', 'level_check_seen', 'level_placements', 'study_plans'] as const;

/**
 * Cleared on the users row. `met_at` gates the one-time first meeting (Part 05
 * §7). `last_greeted_at` drives §8.12's full-vs-"welcome back" choice, and a
 * stale value makes the first greeting after the meeting a same-day repeat —
 * so a reset that left it set would retest the meeting but not the greeting.
 */
const USER_STAMPS = { met_at: null, last_greeted_at: null } as const;

const USAGE = 'usage: tsx src/scripts/reset-student.ts <telegram_id> [--dry-run] [--yes]';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith('--')));
const positional = argv.filter((a) => !a.startsWith('--'));
const dryRun = flags.delete('--dry-run');
const assumeYes = flags.delete('--yes');

if (flags.size > 0) fail(`unknown flag(s): ${[...flags].join(', ')}\n${USAGE}`);
if (positional.length !== 1) fail(USAGE);
const telegramId = positional[0];

const db = createSupabase();

/** Row count for one student in one table, without pulling the rows themselves. */
async function countRows(table: string): Promise<number> {
  const { count, error } = await db
    .from(table)
    .select('telegram_id', { count: 'exact', head: true })
    .eq('telegram_id', telegramId);
  if (error) throw error;
  return count ?? 0;
}

/** Typed "yes", not a bare y/N — this can be pointed at production. */
async function confirmed(): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error('\nrefusing to delete: stdin is not a TTY and --yes was not given.');
    return false;
  }
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await rl.question('\ntype "yes" to reset, anything else to abort: ');
    return answer.trim().toLowerCase() === 'yes';
  } finally {
    rl.close();
  }
}

async function main() {
  const host = new URL(env.SUPABASE_URL).host;

  // Never create the row: resetting a student who doesn't exist is a typo'd id,
  // not a request to make one, and inventing the row would hide the mistake.
  const { data: user, error } = await db
    .from('users')
    .select('telegram_id, name, username, app_language, met_at, last_greeted_at')
    .eq('telegram_id', telegramId)
    .maybeSingle();
  if (error) throw error;
  if (!user) fail(`no users row for telegram_id ${telegramId} on ${host} — nothing to reset.`);

  console.log(`target   ${host}`);
  console.log(`student  ${telegramId}  ${user.name ?? '(no name)'}${user.username ? ' @' + user.username : ''}  lang=${user.app_language}`);
  console.log('\nwill delete:');
  const before: Record<string, number> = {};
  for (const table of PROGRESS_TABLES) {
    before[table] = await countRows(table);
    console.log(`  ${table.padEnd(18)} ${before[table]} row(s)`);
  }
  console.log('will clear on users:');
  for (const field of Object.keys(USER_STAMPS)) {
    console.log(`  ${field.padEnd(18)} ${(user as Record<string, unknown>)[field] ?? 'null'} -> null`);
  }
  console.log('will keep on users: name, username, photo_url, app_language, student_profile, created_at');

  if (dryRun) {
    console.log('\n--dry-run: nothing written.');
    return;
  }
  if (!assumeYes && !(await confirmed())) fail('aborted — nothing written.');

  console.log('');
  for (const table of PROGRESS_TABLES) {
    const { data, error: delError } = await db.from(table).delete().eq('telegram_id', telegramId).select('telegram_id');
    if (delError) throw delError;
    console.log(`deleted ${data?.length ?? 0} row(s) from ${table}`);
  }
  const { error: patchError } = await db.from('users').update(USER_STAMPS).eq('telegram_id', telegramId);
  if (patchError) throw patchError;
  console.log(`cleared ${Object.keys(USER_STAMPS).join(', ')} on users`);

  // Read back rather than trusting the writes: a reset that silently half-applied
  // would send the next test run down the wrong branch with no sign anything broke.
  const leftovers: string[] = [];
  for (const table of PROGRESS_TABLES) {
    const remaining = await countRows(table);
    if (remaining > 0) leftovers.push(`${table} still has ${remaining} row(s)`);
  }
  const { data: after, error: reReadError } = await db
    .from('users')
    .select('met_at, last_greeted_at')
    .eq('telegram_id', telegramId)
    .single();
  if (reReadError) throw reReadError;
  for (const field of Object.keys(USER_STAMPS)) {
    const value = (after as Record<string, unknown>)[field];
    if (value !== null) leftovers.push(`users.${field} is ${String(value)}, expected null`);
  }
  if (leftovers.length > 0) fail(`\nreset INCOMPLETE:\n  ${leftovers.join('\n  ')}`);

  console.log(`\nverified: ${telegramId} is a fresh student on ${host}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
