-- Part 05 — the first meeting (§7) and the persona tone shift (§8).
--
-- §7: a brand-new student meets Bixy once, at the start of their first lesson.
-- `met_at` is what makes it once — stamped when the get-to-know-you is finished
-- OR skipped, since a student who skipped shouldn't be asked again on every
-- visit. The answers themselves are optional and partial (every question is
-- skippable), so they live in one jsonb blob rather than five nullable columns:
-- nothing queries them, they're only ever read back whole and pasted into a
-- prompt.
--
-- `last_greeted_at` already exists (0005) and keeps driving the full/short
-- day-boundary choice — this only adds the stage before it.

alter table users
  add column if not exists met_at timestamptz,
  add column if not exists student_profile jsonb not null default '{}'::jsonb;

-- §8 tone shift: consecutive whole-topic re-teaches (a sub-50% test) on THIS
-- topic. Lives on progress, which is already per student AND per topic, so the
-- "resets per topic" scope rule is the row itself — a struggle on one topic
-- can't leak into the next. Reset to 0 on a pass; see progress.routes.ts, which
-- derives it server-side from the reported score rather than trusting a client
-- to report its own patience level.
alter table progress
  add column if not exists reteach_all_streak integer not null default 0;
