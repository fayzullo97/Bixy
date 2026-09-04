import { TOPIC_LEVELS, type TopicLevel } from '../content/topic.js';

// One level-check question (§8.11), matching reference-material.json's
// `level_check_questions[]` shape. Same six tiers as topics (§8.1), so the tier
// set is reused from the content module rather than duplicated here.

/** A validated level-check question row. `id` is the question's stable identity;
 *  today it equals `topic_id` (they are 1:1 in the curated bank), kept separate
 *  so a topic could carry more than one question later without an id collision. */
export interface LevelCheckQuestionInput {
  id: string;
  topic_id: string;
  level: TopicLevel;
  prompt: string;
  accepted_answers: string[];
}

function fail(index: number, message: string): never {
  throw new Error(`level_check_questions[${index}]: ${message}`);
}

function nonEmptyString(value: unknown, index: number, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(index, `\`${field}\` must be a non-empty string`);
  }
  return value;
}

/**
 * Validates and normalizes one raw level-check question from the JSON. Throws
 * with the array index and field on any problem, so a bad record is easy to
 * locate rather than silently landing malformed data in the database.
 */
export function parseLevelCheckQuestion(raw: unknown, index: number): LevelCheckQuestionInput {
  if (typeof raw !== 'object' || raw === null) fail(index, 'must be an object');
  const r = raw as Record<string, unknown>;

  const level = nonEmptyString(r.level, index, 'level');
  if (!(TOPIC_LEVELS as readonly string[]).includes(level)) {
    fail(index, `\`level\` must be one of ${TOPIC_LEVELS.join(', ')} (got "${level}")`);
  }

  if (
    !Array.isArray(r.accepted_answers) ||
    r.accepted_answers.length === 0 ||
    r.accepted_answers.some((a) => typeof a !== 'string' || a.trim() === '')
  ) {
    fail(index, '`accepted_answers` must be a non-empty array of non-empty strings');
  }

  const topicId = nonEmptyString(r.topic_id, index, 'topic_id');
  return {
    id: topicId,
    topic_id: topicId,
    level: level as TopicLevel,
    prompt: nonEmptyString(r.prompt, index, 'prompt'),
    accepted_answers: r.accepted_answers as string[],
  };
}
