import type { SupabaseClient } from '@supabase/supabase-js';

export const DOODLE_BUCKET = 'doodles';

/**
 * Ensures the public `doodles` bucket exists. Public read is fine here: these are
 * product-owned, non-sensitive line-art assets the client fetches by URL at
 * playback time (§9.1). Idempotent — safe to call on every seed run.
 */
export async function ensureDoodleBucket(db: SupabaseClient): Promise<void> {
  const existing = await db.storage.getBucket(DOODLE_BUCKET);
  if (existing.data) return;

  const { error } = await db.storage.createBucket(DOODLE_BUCKET, {
    public: true,
    fileSizeLimit: '1MB',
  });
  if (error) {
    // Tolerate a concurrent create; only rethrow if the bucket still isn't there.
    const recheck = await db.storage.getBucket(DOODLE_BUCKET);
    if (!recheck.data) throw error;
  }
}

/** Uploads (or overwrites) one SVG. `path` is bucket-relative, e.g. 'person_a.svg'. */
export async function uploadSvg(
  db: SupabaseClient,
  path: string,
  contents: Buffer,
): Promise<void> {
  const { error } = await db.storage.from(DOODLE_BUCKET).upload(path, contents, {
    contentType: 'image/svg+xml',
    upsert: true,
  });
  if (error) throw error;
}

/** Public URL for a stored SVG — what the board renderer will load (Phase 3). */
export function publicSvgUrl(db: SupabaseClient, path: string): string {
  return db.storage.from(DOODLE_BUCKET).getPublicUrl(path).data.publicUrl;
}
