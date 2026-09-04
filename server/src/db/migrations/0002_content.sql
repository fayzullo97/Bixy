-- Phase 2 — Content foundation: reference material (topics) + doodle library.
-- Static, product-owned data ingested from reference-material.json and
-- doodle-library.json (§8.1, §9.1). Row inserts are done by the seed script
-- (src/db/seed.ts) via the service-role API; this file is schema (DDL) only.
--
-- Table-per-phase: the 60 level_check_questions that also live in
-- reference-material.json belong to the level-check phase (§8.11) and are
-- intentionally NOT ingested here.

create table if not exists topics (
  topic_id        text primary key,
  -- CEFR tier. The curated set uses six tiers, including a non-standard B1+.
  level           text not null check (level in ('A1', 'A2', 'B1', 'B1+', 'B2', 'C1')),
  formula         text not null,
  key_idea        text not null,
  -- Arrays of strings, stored as jsonb to match the source JSON shape.
  examples        jsonb not null default '[]'::jsonb,
  common_mistakes jsonb not null default '[]'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists topics_level_idx on topics (level);

create table if not exists doodle_elements (
  id           text primary key,
  name         text not null,
  category     text not null,
  description  text not null,
  asset_status text not null default 'complete',
  -- Path of the SVG within the public `doodles` Storage bucket, e.g. 'person_a.svg'.
  svg_path     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
