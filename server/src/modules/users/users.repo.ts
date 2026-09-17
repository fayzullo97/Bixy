import type { SupabaseClient } from '@supabase/supabase-js';
import type { StudentProfile } from '../generation/persona.js';

export type AppLanguage = 'en' | 'uz' | 'ru';

export interface UserRecord {
  telegram_id: string;
  name: string | null;
  username: string | null;
  photo_url: string | null;
  app_language: AppLanguage;
  /** When the student was last greeted on the board (§8.12); null if never. */
  last_greeted_at?: string | null;
  /** When Bixy first introduced itself (Part 05 §7). Set once the
   *  get-to-know-you is finished OR skipped, so a skip isn't re-asked. */
  met_at?: string | null;
  /** What the student told Bixy then (Part 05 §7); {} when skipped. */
  student_profile?: StudentProfile;
  created_at: string;
  updated_at: string;
}

export interface UpsertUserInput {
  telegramId: string;
  name: string | null;
  username: string | null;
  photoUrl: string | null;
  appLanguage: AppLanguage;
}

export interface UsersRepo {
  /** Insert on first sign-in; on return, refresh profile + language (§9.1). */
  upsert(input: UpsertUserInput): Promise<UserRecord>;
  get(telegramId: string): Promise<UserRecord | null>;
  /** Stamp the greeting time — called each time the continue-prompt fires. */
  setLastGreetedAt(telegramId: string, iso: string): Promise<void>;
  /** Close the first meeting (Part 05 §7): store whatever the student answered
   *  and stamp `met_at`. Called for a skip too, with an empty profile. */
  completeMeeting(telegramId: string, profile: StudentProfile, iso: string): Promise<void>;
  /** The student's chosen UI language (Part 07 §12) — asked as onboarding step
   *  1, before the greeting, so everything after it reads in that language. A
   *  C1 placement later overrides it to English (Part 01 §1) via this same
   *  setter, since the tier isn't known when the question is asked. */
  setAppLanguage(telegramId: string, language: string): Promise<void>;
}

export function supabaseUsersRepo(db: SupabaseClient): UsersRepo {
  return {
    async upsert(input) {
      const { data, error } = await db
        .from('users')
        .upsert(
          {
            telegram_id: input.telegramId,
            name: input.name,
            username: input.username,
            photo_url: input.photoUrl,
            app_language: input.appLanguage,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'telegram_id' },
        )
        .select()
        .single();
      if (error) throw error;
      return data as UserRecord;
    },

    async get(telegramId) {
      const { data, error } = await db
        .from('users')
        .select()
        .eq('telegram_id', telegramId)
        .maybeSingle();
      if (error) throw error;
      return (data as UserRecord | null) ?? null;
    },

    async setLastGreetedAt(telegramId, iso) {
      const { error } = await db
        .from('users')
        .update({ last_greeted_at: iso, updated_at: new Date().toISOString() })
        .eq('telegram_id', telegramId);
      if (error) throw error;
    },

    async setAppLanguage(telegramId, language) {
      const { error } = await db
        .from('users')
        .update({ app_language: language, updated_at: new Date().toISOString() })
        .eq('telegram_id', telegramId);
      if (error) throw error;
    },

    async completeMeeting(telegramId, profile, iso) {
      const { error } = await db
        .from('users')
        .update({ met_at: iso, student_profile: profile, updated_at: new Date().toISOString() })
        .eq('telegram_id', telegramId);
      if (error) throw error;
    },
  };
}
