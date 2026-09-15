-- Part 01 §1 — per-field language split in the board script.
--
-- Formal beats changed shape (content/emphasis → style-specific English-locked
-- fields + a localized `note`), which makes every previously cached lesson
-- unservable: the client validates the script it receives, so an old-shape row
-- would hard-fail the board rather than degrade.
--
-- Rather than bulk-deleting, the cache key gains `rule_version`. Existing rows
-- default to 0 and simply stop matching the current version, so they're never
-- served; they can be garbage-collected later at leisure. The same lever handles
-- the next breaking contract change.

alter table lesson_results
  add column if not exists rule_version integer not null default 0;

-- Swap the primary key to include rule_version. Written as a conditional so the
-- migration stays idempotent (migrate.ts re-applies every file on every run).
do $$
declare
  pk_cols text;
begin
  select string_agg(a.attname, ',' order by k.ord)
    into pk_cols
    from pg_constraint c
    join lateral unnest(c.conkey) with ordinality as k(attnum, ord) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
   where c.conrelid = 'lesson_results'::regclass
     and c.contype = 'p';

  if pk_cols is distinct from 'topic_id,source,language,rule_version' then
    if pk_cols is not null then
      alter table lesson_results drop constraint lesson_results_pkey;
    end if;
    alter table lesson_results
      add constraint lesson_results_pkey primary key (topic_id, source, language, rule_version);
  end if;
end $$;
