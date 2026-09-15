-- Part 04 §6 — the 8-question retest.
--
-- A failed topic test is followed by a re-teach and then a SHORTER retest that
-- leads with the questions the student actually got wrong. That has to survive
-- the re-teach cycle, which can span a session boundary (close the app, come
-- back tomorrow), so it can't live in client state.
--
-- Missed questions are stored as variant FINGERPRINTS, not quiz_question_ids:
-- ids are positional within one generated script and shift whenever a lesson
-- regenerates, while the fingerprint is a hash of the question's own content and
-- survives that. It's also the same key the variant pool uses, so a missed
-- question can be pulled straight back out of the pool by fingerprint.

alter table progress
  add column if not exists missed_fingerprints jsonb not null default '[]'::jsonb;

-- 0 = no retest pending. Increments on each failed retest, and drives §6's
-- second-miss rule: from the second consecutive miss the next round re-teaches
-- the WHOLE topic regardless of which tier the score would otherwise land in.
alter table progress
  add column if not exists retest_round integer not null default 0;
