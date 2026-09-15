import { createHash } from 'node:crypto';
import type { Beat, QuizQuestion } from './boardScript.js';

/** What a pooled variant is. */
export type VariantKind = 'reexplain_segment' | 'quiz_question';

/** An alternate explanation of part of a topic — a short run of beats. */
export interface ReexplainSegment {
  beats: Beat[];
}

/**
 * Content hash used to dedupe the pool.
 *
 * Hashes only the SEMANTIC content, deliberately excluding beat ids, quiz ids,
 * `tests_beat_id` and any synthesized `audio_url` — those differ on every
 * regeneration while the variant is the same one. Without that exclusion the
 * pool would fill with near-duplicates and rotation would stop meaning anything.
 */
export function variantFingerprint(kind: VariantKind, payload: unknown): string {
  const canonical = kind === 'quiz_question'
    ? quizSignature(payload as QuizQuestion)
    : segmentSignature(payload as ReexplainSegment);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 32);
}

const norm = (text: string): string => text.trim().toLowerCase().replace(/\s+/gu, ' ');

function quizSignature(q: QuizQuestion): string {
  // Option ORDER is part of the identity: the same stem with reordered options is
  // a different question to answer, and `correct_index` points into that order.
  return [
    q.type,
    norm(q.question),
    (q.options ?? []).map(norm).join('|'),
    // Accepted answers are a set, not a sequence — sort so ordering noise from
    // the model doesn't read as a new variant.
    [...(q.accepted_answers ?? [])].map(norm).sort().join('|'),
  ].join('::');
}

function segmentSignature(segment: ReexplainSegment): string {
  return segment.beats
    .map((b) => {
      if (b.type === 'story_beat') return `s:${norm(b.narration)}`;
      switch (b.style) {
        case 'title':
          return `t:${norm(b.term)}`;
        case 'formula':
          return `f:${norm(b.formula)}|${norm(b.note ?? '')}`;
        case 'explanation':
          return `e:${norm(b.note)}`;
        case 'example':
        case 'recap_example':
          return `x:${norm(b.sentence)}|${norm(b.note ?? '')}`;
        case 'common_mistake':
          return `m:${norm(b.wrong)}|${norm(b.correct)}|${norm(b.note)}`;
        case 'check_in_question':
          return `c:${norm(b.question)}|${b.options.map(norm).join('|')}`;
      }
    })
    .join('\n');
}
