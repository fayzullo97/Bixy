export const TOPIC_LEVELS = ['A1', 'A2', 'B1', 'B1+', 'B2', 'C1'] as const;
export type TopicLevel = (typeof TOPIC_LEVELS)[number];

/** A topic outline row, matching reference-material.json's `topics[]` shape (§8.1). */
export interface TopicInput {
  topic_id: string;
  level: TopicLevel;
  formula: string;
  key_idea: string;
  examples: string[];
  common_mistakes: string[];
}

function fail(index: number, message: string): never {
  throw new Error(`topics[${index}]: ${message}`);
}

function nonEmptyString(value: unknown, index: number, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(index, `\`${field}\` must be a non-empty string`);
  }
  return value;
}

function stringArray(value: unknown, index: number, field: string): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    fail(index, `\`${field}\` must be an array of strings`);
  }
  return value as string[];
}

/**
 * Validates and normalizes one raw topic from the JSON. Throws with the array
 * index and field on any problem, so a bad record is easy to locate rather than
 * silently landing malformed data in the database.
 */
export function parseTopic(raw: unknown, index: number): TopicInput {
  if (typeof raw !== 'object' || raw === null) fail(index, 'must be an object');
  const r = raw as Record<string, unknown>;

  const level = nonEmptyString(r.level, index, 'level');
  if (!(TOPIC_LEVELS as readonly string[]).includes(level)) {
    fail(index, `\`level\` must be one of ${TOPIC_LEVELS.join(', ')} (got "${level}")`);
  }

  return {
    topic_id: nonEmptyString(r.topic_id, index, 'topic_id'),
    level: level as TopicLevel,
    formula: nonEmptyString(r.formula, index, 'formula'),
    key_idea: nonEmptyString(r.key_idea, index, 'key_idea'),
    examples: stringArray(r.examples, index, 'examples'),
    common_mistakes: stringArray(r.common_mistakes, index, 'common_mistakes'),
  };
}
