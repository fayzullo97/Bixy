import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '../../config/env.js';

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

/**
 * Public URL for an already-uploaded narration path.
 *
 * Built from `SUPABASE_URL` rather than through a `SupabaseClient`, so callers
 * that only need to NAME a clip (the greeting route) don't have to hold a
 * database handle for what is pure string work. This is the same shape
 * `getPublicUrl` returns for a public bucket.
 */
export function narrationPublicUrl(path: string): string {
  const base = env.SUPABASE_URL.replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/${env.NARRATION_BUCKET}/${path}`;
}
