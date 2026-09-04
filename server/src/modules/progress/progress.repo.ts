import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProgressRecord {
  telegram_id: string;
  topic_id: string;
  status: 'started' | 'passed';
  quiz_score: number | null;
  last_completed_beat: number | null;
  mastered: boolean;
  updated_at: string;
}

/** Fields a client may write. topic_id + telegram_id come from the route/session. */
export interface ProgressPatch {
  status?: 'started' | 'passed';
  quiz_score?: number | null;
  last_completed_beat?: number | null;
  mastered?: boolean;
}

export interface ProgressRepo {
  listForUser(telegramId: string): Promise<ProgressRecord[]>;
  upsert(telegramId: string, topicId: string, patch: ProgressPatch): Promise<ProgressRecord>;
}

export function supabaseProgressRepo(db: SupabaseClient): ProgressRepo {
  return {
    async listForUser(telegramId) {
      const { data, error } = await db
        .from('progress')
        .select()
        .eq('telegram_id', telegramId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data as ProgressRecord[]) ?? [];
    },

    async upsert(telegramId, topicId, patch) {
      const { data, error } = await db
        .from('progress')
        .upsert(
          {
            telegram_id: telegramId,
            topic_id: topicId,
            ...patch,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'telegram_id,topic_id' },
        )
        .select()
        .single();
      if (error) throw error;
      return data as ProgressRecord;
    },
  };
}
