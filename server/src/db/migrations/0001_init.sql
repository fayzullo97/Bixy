-- Phase 1 — Foundation data model (§8.8 auth identity, §8.9 progress).
-- Keyed off the student's Telegram user ID, a real durable identity (§8.8).
-- Table-per-phase: later phases add variant-seen / level-check / study-plan
-- tables that reference users(telegram_id); those are intentionally NOT here.

create table if not exists users (
  -- Telegram user id (OIDC `sub`). Stored as text since it arrives as a string claim.
  telegram_id  text primary key,
  -- Profile fields from the `profile` scope, refreshed on every sign-in (§9.1).
  name         text,
  username     text,
  photo_url    text,
  -- App language chosen on the sign-in screen (§8.7): drives narration + UI copy.
  app_language text not null check (app_language in ('en', 'uz', 'ru')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists progress (
  telegram_id        text not null references users (telegram_id) on delete cascade,
  topic_id           text not null,
  -- 'started' when a lesson is opened, 'passed' once its quiz is passed (§8.9).
  status             text not null default 'started' check (status in ('started', 'passed')),
  quiz_score         integer,
  -- Resume point: last beat completed, so a mid-lesson return picks up here (§8.9).
  last_completed_beat integer,
  mastered           boolean not null default false,
  updated_at         timestamptz not null default now(),
  primary key (telegram_id, topic_id)
);

create index if not exists progress_telegram_id_idx on progress (telegram_id);
