import type Anthropic from '@anthropic-ai/sdk';
import type { MessagesClient } from './anthropic';
import type { TopicCatalogEntry } from '../content/content.repo';

export type IdentifyResult = { ok: true; topicId: string } | { ok: false };

export interface IdentifyDeps {
  anthropic: MessagesClient;
  topics: TopicCatalogEntry[];
}

function firstText(message: Anthropic.Message): string {
  const block = message.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  return (block?.text ?? '').trim();
}

const RESOLVE_SYSTEM =
  'You map a request to exactly one topic_id from a fixed list of English-grammar topics. ' +
  'If the request is off-topic, not English grammar, or does not clearly match any listed topic, reply NONE. ' +
  'Reply with ONLY the topic_id or NONE — no other words.';

const PHOTO_SYSTEM =
  'You identify which English grammar topic a photo (a blackboard, textbook page, or handwritten notes) is about, ' +
  'mapping it to exactly one topic_id from a fixed list. If the photo is unreadable or does not clearly correspond ' +
  'to a listed topic, reply NONE. Reply with ONLY the topic_id or NONE — no other words.';

function resolveAnswer(topics: TopicCatalogEntry[], answer: string): IdentifyResult {
  const match = topics.find((t) => t.topic_id === answer);
  return match ? { ok: true, topicId: match.topic_id } : { ok: false };
}

/**
 * Resolves a typed request to a topic_id (§8.1). Tries a direct id/slug match
 * first (free, no model call), then falls back to the model to map free phrasing
 * onto the catalog — or NONE for anything off the grammar path, which the caller
 * turns into "I don't have information about that."
 */
export async function identifyTopicFromText(
  deps: IdentifyDeps,
  model: string,
  text: string,
): Promise<IdentifyResult> {
  const normalized = text.trim().toLowerCase();
  const slug = normalized.replace(/[\s-]+/g, '_');
  const direct = deps.topics.find((t) => t.topic_id === normalized || t.topic_id === slug);
  if (direct) return { ok: true, topicId: direct.topic_id };

  const list = deps.topics.map((t) => t.topic_id).join('\n');
  const message = await deps.anthropic.messages.create({
    model,
    max_tokens: 60,
    system: RESOLVE_SYSTEM,
    messages: [{ role: 'user', content: `Request: "${text}"\n\nAllowed topic_ids:\n${list}\n\nReply with one topic_id or NONE.` }],
  });
  return resolveAnswer(deps.topics, firstText(message));
}

/** Identifies the topic shown in a photo (§8.1) using an image-capable model. */
export async function identifyTopicFromImage(
  deps: IdentifyDeps,
  model: string,
  image: { base64: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' },
): Promise<IdentifyResult> {
  const list = deps.topics.map((t) => t.topic_id).join('\n');
  const message = await deps.anthropic.messages.create({
    model,
    max_tokens: 60,
    system: PHOTO_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.base64 } },
          { type: 'text', text: `Allowed topic_ids:\n${list}\n\nReply with one topic_id or NONE.` },
        ],
      },
    ],
  });
  return resolveAnswer(deps.topics, firstText(message));
}
