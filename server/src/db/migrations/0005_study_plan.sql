-- Phase 7 — Study plan & dashboard (§8.12).
-- Table-per-phase: the fixed, computed-once path a student walks after the level
-- check places them. Row inserts are per-user (written by the app), not seeded.

-- A student's ordered path (§8.12). One row per user, replaced outright when a
-- level-check retake lands a different placement — no splicing with old progress.
create table if not exists study_plans (
  telegram_id       text primary key references users (telegram_id) on delete cascade,
  -- The placement this plan was built from; a retake at a *different* level
  -- rebuilds the plan, a retake at the same level leaves it (and progress) alone.
  level             text not null check (level in ('A1', 'A2', 'B1', 'B1+', 'B2', 'C1')),
  -- The fixed sequence of topic_ids, in study order (§8.12 ordering rules).
  ordered_topic_ids jsonb not null default '[]'::jsonb,
  -- How far along the path the student has been advanced (§8.12). Advancing is
  -- moving this forward, not recomputing the plan; detour-passed topics ahead are
  -- skipped on read against the progress records, not by moving this backward.
  current_position  integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- When the student was last greeted on the board (§8.12 / §9.1). Drives the
-- full-vs-"welcome back" greeting: the first prompt of a calendar day is full,
-- the rest that day are short. Nullable — never greeted yet.
alter table users add column if not exists last_greeted_at timestamptz;

-- The authored pedagogical order of the reference material (§8.1), set by the
-- seed to each topic's index in reference-material.json. The study plan walks
-- families in this order rather than an arbitrary (e.g. alphabetical) one.
alter table topics add column if not exists sort_order integer;

create index if not exists topics_sort_order_idx on topics (sort_order);
