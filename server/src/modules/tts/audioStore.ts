import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env';

/** Ensures the public `narration` bucket exists (audio is non-sensitive; the client fetches by URL). */
export async function ensureNarrationBucket(db: SupabaseClient): Promise<void> {
  const existing = await db.storage.getBucket(env.NARRATION_BUCKET);
  if (existing.data) return;
  const { error } = await db.storage.createBucket(env.NARRATION_BUCKET, {
    public: true,
    fileSizeLimit: '5MB',
  });
  if (error) {
    const recheck = await db.storage.getBucket(env.NARRATION_BUCKET);
    if (!recheck.data) throw error;
  }
}

/** Uploads (or overwrites) a narration WAV and returns its public URL. */
export async function uploadNarration(
  db: SupabaseClient,
  path: string,
  wav: Buffer,
): Promise<string> {
  const { error } = await db.storage.from(env.NARRATION_BUCKET).upload(path, wav, {
    contentType: 'audio/wav',
    upsert: true,
  });
  if (error) throw error;
  return db.storage.from(env.NARRATION_BUCKET).getPublicUrl(path).data.publicUrl;
}
