import type { SupabaseClient } from '@supabase/supabase-js';
import type { LevelCheckQuestionInput } from './levelCheckQuestion.js';

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** A level-check question as the client's adaptive test needs it (§8.11). The
 *  accepted answers ship to the client — consistent with the rest of the app,
 *  which already keeps quiz/check-in answers client-side; grading still routes
 *  through /assessment/grade for the AI fallback (see assessment.ts). */
export interface LevelCheckQuestion {
  id: string;
  topic_id: string;
  level: string;
  prompt: string;
  accepted_answers: string[];
}

export interface LevelCheckRepo {
  /** The full pregenerated bank (§8.11). */
  listQuestions(): Promise<LevelCheckQuestion[]>;
  /** Question ids this student has already been shown (§8.11 Retaking). */
  listSeen(telegramId: string): Promise<string[]>;
  /** Record that a question was shown — best-effort, drives prefer-unseen. */
  markSeen(telegramId: string, questionId: string): Promise<void>;
  /** The student's current placement, or null if they've never completed one. */
  getPlacement(telegramId: string): Promise<string | null>;
  /** Overwrite the student's placement on a completed attempt/retake. */
  setPlacement(telegramId: string, level: string): Promise<void>;
  /** Seed-time ingestion of the question bank from reference-material.json. */
  upsertQuestions(questions: LevelCheckQuestionInput[]): Promise<number>;
}

export function supabaseLevelCheckRepo(db: SupabaseClient): LevelCheckRepo {
  return {
    async listQuestions() {
      const { data, error } = await db
        .from('level_check_questions')
        .select('id, topic_id, level, prompt, accepted_answers')
        .order('level')
        .order('id');
      if (error) throw error;
      return (data as LevelCheckQuestion[]) ?? [];
    },

    async listSeen(telegramId) {
      const { data, error } = await db
        .from('level_check_seen')
        .select('question_id')
        .eq('telegram_id', telegramId);
      if (error) throw error;
      return (data ?? []).map((row) => row.question_id as string);
    },

    async markSeen(telegramId, questionId) {
      const { error } = await db.from('level_check_seen').upsert(
        { telegram_id: telegramId, question_id: questionId, seen_at: new Date().toISOString() },
        { onConflict: 'telegram_id,question_id' },
      );
      if (error) throw error;
    },

    async getPlacement(telegramId) {
      const { data, error } = await db
        .from('level_placements')
        .select('level')
        .eq('telegram_id', telegramId)
        .maybeSingle();
      if (error) throw error;
      return (data?.level as string | undefined) ?? null;
    },

    async setPlacement(telegramId, level) {
      const { error } = await db.from('level_placements').upsert(
        { telegram_id: telegramId, level, updated_at: new Date().toISOString() },
        { onConflict: 'telegram_id' },
      );
      if (error) throw error;
    },

    async upsertQuestions(questions) {
      const now = new Date().toISOString();
      for (const batch of chunk(questions, 200)) {
        const { error } = await db
          .from('level_check_questions')
          .upsert(
            batch.map((q) => ({ ...q, updated_at: now })),
            { onConflict: 'id' },
          );
        if (error) throw error;
      }
      return questions.length;
    },
  };
}
