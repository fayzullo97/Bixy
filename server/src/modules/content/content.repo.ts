import type { SupabaseClient } from '@supabase/supabase-js';
import type { TopicInput } from './topic.js';
import type { DoodleRow } from './doodle.js';
import { publicSvgUrl } from './doodle-storage.js';

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** A doodle as the board renderer needs it: metadata plus the SVG's public URL. */
export interface DoodleCatalogEntry {
  id: string;
  category: string;
  description: string;
  url: string;
}

/** A topic's full outline — the grounding for one lesson (§8.1). */
export interface TopicOutline {
  topic_id: string;
  level: string;
  formula: string;
  key_idea: string;
  examples: string[];
  common_mistakes: string[];
}

/** A compact catalog row for topic identification (no full outlines). */
export interface TopicCatalogEntry {
  topic_id: string;
  level: string;
}

/** A topic row the study plan needs: id, tier, and authored order (§8.12). */
export interface PlanTopicRow {
  topic_id: string;
  level: string;
  sort_order: number | null;
}

export interface ContentRepo {
  upsertTopics(topics: TopicInput[]): Promise<number>;
  upsertDoodles(doodles: DoodleRow[]): Promise<number>;
  countTopics(): Promise<number>;
  countDoodles(): Promise<number>;
  listDoodles(): Promise<DoodleCatalogEntry[]>;
  getTopic(topicId: string): Promise<TopicOutline | null>;
  listTopicsCompact(): Promise<TopicCatalogEntry[]>;
  listTopicsForPlan(): Promise<PlanTopicRow[]>;
}

export function supabaseContentRepo(db: SupabaseClient): ContentRepo {
  return {
    async upsertTopics(topics) {
      const now = new Date().toISOString();
      for (const batch of chunk(topics, 200)) {
        const { error } = await db
          .from('topics')
          .upsert(
            batch.map((t) => ({ ...t, updated_at: now })),
            { onConflict: 'topic_id' },
          );
        if (error) throw error;
      }
      return topics.length;
    },

    async upsertDoodles(doodles) {
      const now = new Date().toISOString();
      const { error } = await db
        .from('doodle_elements')
        .upsert(
          doodles.map((d) => ({ ...d, updated_at: now })),
          { onConflict: 'id' },
        );
      if (error) throw error;
      return doodles.length;
    },

    async countTopics() {
      const { count, error } = await db
        .from('topics')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },

    async countDoodles() {
      const { count, error } = await db
        .from('doodle_elements')
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count ?? 0;
    },

    async listDoodles() {
      const { data, error } = await db
        .from('doodle_elements')
        .select('id, category, description, svg_path')
        .order('id');
      if (error) throw error;
      return (data ?? []).map((row) => ({
        id: row.id as string,
        category: row.category as string,
        description: row.description as string,
        url: row.svg_path ? publicSvgUrl(db, row.svg_path as string) : '',
      }));
    },

    async getTopic(topicId) {
      const { data, error } = await db
        .from('topics')
        .select('topic_id, level, formula, key_idea, examples, common_mistakes')
        .eq('topic_id', topicId)
        .maybeSingle();
      if (error) throw error;
      return (data as TopicOutline | null) ?? null;
    },

    async listTopicsCompact() {
      const { data, error } = await db.from('topics').select('topic_id, level').order('topic_id');
      if (error) throw error;
      return (data as TopicCatalogEntry[]) ?? [];
    },

    async listTopicsForPlan() {
      const { data, error } = await db
        .from('topics')
        .select('topic_id, level, sort_order')
        .order('sort_order', { nullsFirst: false });
      if (error) throw error;
      return (data as PlanTopicRow[]) ?? [];
    },
  };
}
