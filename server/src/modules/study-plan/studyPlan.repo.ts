import type { SupabaseClient } from '@supabase/supabase-js';

/** A stored study plan row (§8.12). */
export interface StudyPlanRecord {
  telegram_id: string;
  level: string;
  ordered_topic_ids: string[];
  current_position: number;
}

export interface StudyPlanRepo {
  get(telegramId: string): Promise<StudyPlanRecord | null>;
  /** Create or replace the plan outright (a retake rebuilds, §8.12). */
  replace(telegramId: string, level: string, orderedTopicIds: string[]): Promise<StudyPlanRecord>;
  /** Move the stored position forward (§8.12 advancing). */
  setPosition(telegramId: string, position: number): Promise<void>;
}

export function supabaseStudyPlanRepo(db: SupabaseClient): StudyPlanRepo {
  return {
    async get(telegramId) {
      const { data, error } = await db
        .from('study_plans')
        .select('telegram_id, level, ordered_topic_ids, current_position')
        .eq('telegram_id', telegramId)
        .maybeSingle();
      if (error) throw error;
      return (data as StudyPlanRecord | null) ?? null;
    },

    async replace(telegramId, level, orderedTopicIds) {
      const { data, error } = await db
        .from('study_plans')
        .upsert(
          {
            telegram_id: telegramId,
            level,
            ordered_topic_ids: orderedTopicIds,
            current_position: 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'telegram_id' },
        )
        .select('telegram_id, level, ordered_topic_ids, current_position')
        .single();
      if (error) throw error;
      return data as StudyPlanRecord;
    },

    async setPosition(telegramId, position) {
      const { error } = await db
        .from('study_plans')
        .update({ current_position: position, updated_at: new Date().toISOString() })
        .eq('telegram_id', telegramId);
      if (error) throw error;
    },
  };
}
