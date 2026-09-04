import type { SupabaseClient } from '@supabase/supabase-js';
import type { BoardScript } from './boardScript';
import type { Language } from './systemPrompt';

export interface LessonCacheRepo {
  get(topicId: string, source: string, language: Language): Promise<BoardScript | null>;
  put(topicId: string, source: string, language: Language, script: BoardScript, model: string): Promise<void>;
}

export function supabaseLessonCacheRepo(db: SupabaseClient): LessonCacheRepo {
  return {
    async get(topicId, source, language) {
      const { data, error } = await db
        .from('lesson_results')
        .select('board_script')
        .eq('topic_id', topicId)
        .eq('source', source)
        .eq('language', language)
        .maybeSingle();
      if (error) throw error;
      return data ? (data.board_script as BoardScript) : null;
    },

    async put(topicId, source, language, script, model) {
      const { error } = await db.from('lesson_results').upsert(
        {
          topic_id: topicId,
          source,
          language,
          board_script: script,
          model,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'topic_id,source,language' },
      );
      if (error) throw error;
    },
  };
}
