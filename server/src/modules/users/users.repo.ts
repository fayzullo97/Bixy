import type { SupabaseClient } from '@supabase/supabase-js';

export type AppLanguage = 'en' | 'uz' | 'ru';

export interface UserRecord {
  telegram_id: string;
  name: string | null;
  username: string | null;
  photo_url: string | null;
  app_language: AppLanguage;
  /** When the student was last greeted on the board (§8.12); null if never. */
  last_greeted_at?: string | null;
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
  /** When this student was last greeted (§8.12), or null if never. */
  getLastGreetedAt(telegramId: string): Promise<string | null>;
  /** Stamp the greeting time — called each time the continue-prompt fires. */
  setLastGreetedAt(telegramId: string, iso: string): Promise<void>;
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

    async getLastGreetedAt(telegramId) {
      const { data, error } = await db
        .from('users')
        .select('last_greeted_at')
        .eq('telegram_id', telegramId)
        .maybeSingle();
      if (error) throw error;
      return (data?.last_greeted_at as string | null | undefined) ?? null;
    },

    async setLastGreetedAt(telegramId, iso) {
      const { error } = await db
        .from('users')
        .update({ last_greeted_at: iso, updated_at: new Date().toISOString() })
        .eq('telegram_id', telegramId);
      if (error) throw error;
    },
  };
}
