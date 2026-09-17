-- Part 04 — the variant pool.
--
-- Designed in v1 ("repeat/failed-check content pulls an existing stored variant
-- before generating a new one") but never actually built: `pickReTeachVariant`
-- shipped as a one-line pass-through with no storage behind it. Part 04's
-- 8-question retest (§6) and detour wrap-up check-in (§13) both depend on it as
-- real infrastructure, so it gets built here.
--
-- One row per distinct variant, scoped to a topic AND a language: a Russian
-- lesson's alternate explanation is not interchangeable with an English one.
-- `fingerprint` is a content hash, so re-harvesting the same lesson (a cache
-- miss, a rule_version bump, another student on the same topic) tops the pool up
-- instead of duplicating it.

create table if not exists topic_variants (
  id           bigserial primary key,
  topic_id     text not null references topics (topic_id) on delete cascade,
  language     text not null check (language in ('en', 'uz', 'ru')),
  -- 'quiz_question'     — a single question, for filling a retest (§6)
  -- 'reexplain_segment' — an alternate explanation, for a re-teach (§13, §9.2)
  kind         text not null check (kind in ('reexplain_segment', 'quiz_question')),
  fingerprint  text not null,
  payload      jsonb not null,
  -- Drives rotation: least-served variants come back first, so a student who
  -- keeps missing a topic isn't handed the same alternate every time.
  used_count   integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (topic_id, language, kind, fingerprint)
);

-- Matches the only read pattern: "least-used variants of this kind for this
-- topic+language".
create index if not exists topic_variants_lookup
  on topic_variants (topic_id, language, kind, used_count);
