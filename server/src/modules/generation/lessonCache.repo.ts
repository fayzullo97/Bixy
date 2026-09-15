import type { SupabaseClient } from '@supabase/supabase-js';
import { BOARD_SCRIPT_RULE_VERSION, type BoardScript } from './boardScript.js';
import type { Language } from './systemPrompt.js';

export interface LessonCacheRepo {
  get(topicId: string, source: string, language: Language): Promise<BoardScript | null>;
  put(topicId: string, source: string, language: Language, script: BoardScript, model: string): Promise<void>;
}

/**
 * Result cache for generated lessons (§9.2), keyed by
 * (topic, source, effective language, board-script rule version).
 *
 * `rule_version` is what makes a breaking schema change safe: rows written under
 * an older contract simply stop matching, so they're never served to a client
 * whose validator would reject them — no bulk delete, and the same lever is there
 * for the next contract change. `language` is the EFFECTIVE content language
 * (Part 01 §1), not the student's raw selection.
 */
export function supabaseLessonCacheRepo(db: SupabaseClient): LessonCacheRepo {
  return {
    async get(topicId, source, language) {
      const { data, error } = await db
        .from('lesson_results')
        .select('board_script')
        .eq('topic_id', topicId)
        .eq('source', source)
        .eq('language', language)
        .eq('rule_version', BOARD_SCRIPT_RULE_VERSION)
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
          rule_version: BOARD_SCRIPT_RULE_VERSION,
          board_script: script,
          model,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'topic_id,source,language,rule_version' },
      );
      if (error) throw error;
    },
  };
}
