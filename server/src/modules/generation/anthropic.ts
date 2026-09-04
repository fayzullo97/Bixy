import Anthropic from '@anthropic-ai/sdk';
import { env } from '../../config/env.js';

/** Shared Claude client. Reads ANTHROPIC_API_KEY from env. */
export const anthropic = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

export const MODELS = {
  /** Routine, high-volume lesson generation (§9.1). */
  generation: env.GEN_MODEL,
  /** Photo topic-identification — needs more careful reasoning (§9.1). */
  topicId: env.TOPIC_ID_MODEL,
  /** Fill-in-the-blank grading fallback — a cheap yes/no judgment (§8.11). */
  grade: env.GRADE_MODEL,
};

/** The subset of the SDK the generation modules use — lets tests inject a fake. */
export type MessagesClient = Pick<Anthropic, 'messages'>;
