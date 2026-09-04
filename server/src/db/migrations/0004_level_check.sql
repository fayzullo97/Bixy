-- Phase 6 — Level check (§8.11).
-- Table-per-phase: the 60 level_check_questions that ride along in
-- reference-material.json were deferred from Phase 2 (§8.1) and land here, plus
-- the per-student seen-tracking and placement that §8.11's "Retaking" needs.
-- Row inserts for the question bank are done by the seed script (src/db/seed.ts)
-- via the service-role API; this file is schema (DDL) only.

-- The pregenerated question bank: 10 per level, 60 total, authored + reviewed
-- once (§8.11). `id` is decoupled from `topic_id` so a topic could carry more
-- than one question later; today they are 1:1 (id = topic_id at seed time).
create table if not exists level_check_questions (
  id              text primary key,
  topic_id        text not null references topics (topic_id) on delete cascade,
  -- Same six CEFR tiers as topics (§8.1), including the non-standard B1+.
  level           text not null check (level in ('A1', 'A2', 'B1', 'B1+', 'B2', 'C1')),
  -- Fill-in-the-blank stem, e.g. "She ___ (visit) her grandmother ...".
  prompt          text not null,
  -- Accepted-answer list for the deterministic grading pass (§8.11); jsonb to
  -- match the source JSON shape.
  accepted_answers jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists level_check_questions_level_idx on level_check_questions (level);

-- Which specific level-check questions a student has already been shown (§8.11
-- Retaking). "Prefer unseen" reads this on both a first attempt and a retake;
-- with only 10 per level, exhaustion falls back to allowing a repeat.
create table if not exists level_check_seen (
  telegram_id text not null references users (telegram_id) on delete cascade,
  question_id text not null references level_check_questions (id) on delete cascade,
  seen_at     timestamptz not null default now(),
  primary key (telegram_id, question_id)
);

-- The student's current placement. One row per user, overwritten on each
-- completed attempt (§8.11 is "not strictly one-time" — a retake updates it).
-- Kept out of the Phase 1 `users` table to keep this phase's schema self-contained.
create table if not exists level_placements (
  telegram_id text primary key references users (telegram_id) on delete cascade,
  level       text not null check (level in ('A1', 'A2', 'B1', 'B1+', 'B2', 'C1')),
  updated_at  timestamptz not null default now()
);
