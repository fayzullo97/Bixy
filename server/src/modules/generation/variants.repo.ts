import type { SupabaseClient } from '@supabase/supabase-js';
import type { Language } from './systemPrompt.js';
import { variantFingerprint, type VariantKind } from './variants.js';

export interface VariantRecord<T = unknown> {
  id: number;
  fingerprint: string;
  payload: T;
  used_count: number;
}

export interface VariantsRepo {
  /**
   * Adds variants to a topic's pool, ignoring any already pooled. Returns how
   * many were genuinely new — useful for logging how the pool is filling.
   */
  put(topicId: string, language: Language, kind: VariantKind, payloads: unknown[]): Promise<number>;
  /**
   * Least-served variants first, so the pool rotates instead of handing back the
   * same alternate every time. `excludeFingerprints` skips content the student
   * has just seen.
   */
  take<T>(
    topicId: string,
    language: Language,
    kind: VariantKind,
    limit: number,
    excludeFingerprints?: string[],
  ): Promise<VariantRecord<T>[]>;
  /** Records that variants were served, advancing the rotation. */
  markUsed(ids: number[]): Promise<void>;
}

export function supabaseVariantsRepo(db: SupabaseClient): VariantsRepo {
  return {
    async put(topicId, language, kind, payloads) {
      if (payloads.length === 0) return 0;

      // Dedupe within the batch first — one lesson can legitimately contain two
      // identically-worded questions, and the upsert would otherwise conflict
      // with itself in a single statement.
      const rows = new Map<string, Record<string, unknown>>();
      for (const payload of payloads) {
        const fingerprint = variantFingerprint(kind, payload);
        if (!rows.has(fingerprint)) {
          rows.set(fingerprint, { topic_id: topicId, language, kind, fingerprint, payload });
        }
      }

      const { data, error } = await db
        .from('topic_variants')
        .upsert([...rows.values()], {
          onConflict: 'topic_id,language,kind,fingerprint',
          // Keep the existing row (and its used_count) when it's already pooled;
          // re-harvesting must not reset rotation.
          ignoreDuplicates: true,
        })
        .select('id');
      if (error) throw error;
      return data?.length ?? 0;
    },

    async take(topicId, language, kind, limit, excludeFingerprints = []) {
      if (limit <= 0) return [];
      let query = db
        .from('topic_variants')
        .select('id, fingerprint, payload, used_count')
        .eq('topic_id', topicId)
        .eq('language', language)
        .eq('kind', kind);
      if (excludeFingerprints.length > 0) {
        query = query.not('fingerprint', 'in', `(${excludeFingerprints.join(',')})`);
      }
      const { data, error } = await query
        .order('used_count', { ascending: true })
        .order('id', { ascending: true })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as VariantRecord<never>[];
    },

    async markUsed(ids) {
      if (ids.length === 0) return;
      // Read-modify-write rather than an atomic increment: used_count only orders
      // rotation, so a lost update under concurrency costs nothing but a variant
      // being reused slightly sooner. Not worth an RPC for that.
      const { data, error } = await db.from('topic_variants').select('id, used_count').in('id', ids);
      if (error) throw error;
      await Promise.all(
        (data ?? []).map((row) =>
          db
            .from('topic_variants')
            .update({ used_count: (row.used_count as number) + 1 })
            .eq('id', row.id),
        ),
      );
    },
  };
}
