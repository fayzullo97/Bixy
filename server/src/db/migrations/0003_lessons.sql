-- Phase 4 — Result cache for generated lessons (§9.2).
-- One row per (topic, source, language). A hit is served with no Claude or TTS
-- call. The stored board_script has audio URLs embedded on its story beats, so
-- script + audio are served together. Variant pooling (§9.2) is driven by
-- re-explanation requests and lands with Phase 5 — intentionally not here.

create table if not exists lesson_results (
  topic_id     text not null references topics (topic_id) on delete cascade,
  source       text not null default 'reference_material',
  language     text not null check (language in ('en', 'uz', 'ru')),
  board_script jsonb not null,
  model        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (topic_id, source, language)
);
