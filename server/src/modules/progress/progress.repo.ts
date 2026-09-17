import type { SupabaseClient } from '@supabase/supabase-js';

export interface ProgressRecord {
  telegram_id: string;
  topic_id: string;
  status: 'started' | 'passed';
  quiz_score: number | null;
  last_completed_beat: number | null;
  mastered: boolean;
  /** Fingerprints of questions missed on the last attempt (Part 04 §6). Stored
   *  as content hashes rather than quiz ids so they survive a regeneration. */
  missed_fingerprints: string[];
  /** 0 = no retest pending; increments per failed retest, driving §6's
   *  second-miss escalation to a whole-topic re-teach. */
  retest_round: number;
  /** Consecutive whole-topic re-teaches (sub-50% tests) on this topic, driving
   *  the persona tone shift (Part 05 §8). Reset to 0 on a pass. Per topic
   *  because the row is — a struggle here never carries into the next topic. */
  reteach_all_streak: number;
  updated_at: string;
}

/** Fields a client may write. topic_id + telegram_id come from the route/session. */
export interface ProgressPatch {
  status?: 'started' | 'passed';
  quiz_score?: number | null;
  last_completed_beat?: number | null;
  mastered?: boolean;
  missed_fingerprints?: string[];
  retest_round?: number;
  reteach_all_streak?: number;
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
