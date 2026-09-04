import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';

/**
 * Server-side Supabase client using the service-role key. This bypasses RLS,
 * so it must never be exposed to the client — it lives only in the backend.
 */
export function createSupabase(): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
