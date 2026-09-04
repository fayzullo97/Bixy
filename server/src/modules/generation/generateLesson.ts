import type Anthropic from '@anthropic-ai/sdk';
import type { MessagesClient } from './anthropic';
import { buildSystemPrompt, buildUserPrompt, type Language } from './systemPrompt';
import { parseBoardScript, type BoardScript } from './boardScript';
import { scriptLanguageIssue } from './languageCheck';
import type { DoodleCatalogEntry, TopicOutline } from '../content/content.repo';

const MAX_ATTEMPTS = 3;

export interface GenerateDeps {
  anthropic: MessagesClient;
  model: string;
  doodles: DoodleCatalogEntry[];
}

export function extractText(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

/** Pulls the JSON object out of the model's reply, tolerating stray prose or fences. */
export function parseJsonLoose(text: string): unknown {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('no JSON object found in model output');
  return JSON.parse(cleaned.slice(start, end + 1));
}

/**
 * Generates a board script for one topic, grounded in its outline (§8.1) and in
 * Bixy's voice (§8.13). The stable persona/schema prompt is sent as a cached
 * block; the volatile topic + language go in the user turn.
 *
 * Two failure classes share the attempt budget (§8.10): a failed generation
 * *call* (network/timeout/overload) is transient — we retry the same prompt; an
 * invalid *output* (schema miss, missing quiz, or wrong language for the request,
 * §8.7) is fed back as a correction and retried. Exhausting the budget throws,
 * which the route surfaces as a plain error rather than a degraded lesson.
 */
export async function generateLesson(
  deps: GenerateDeps,
  input: { topic: TopicOutline; language: Language },
): Promise<{ script: BoardScript; attempts: number }> {
  const system = buildSystemPrompt(deps.doodles);
  const knownElementIds = new Set(deps.doodles.map((d) => d.id));
  const userPrompt = buildUserPrompt(input.topic, input.language);

  let correction = '';
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let message: Anthropic.Message;
    try {
      message = await deps.anthropic.messages.create({
        model: deps.model,
        // Higher than the lesson-only budget in Phase 4: the script now also carries
        // the 10–15 question end-of-topic test (§8.4) in the same reply.
        max_tokens: 12000,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userPrompt + correction }],
      });
    } catch (error) {
      // A failed generation call — transient. Retry the same prompt within the
      // budget rather than surface a one-off blip; keep any pending correction.
      lastError = error;
      continue;
    }

    try {
      const json = parseJsonLoose(extractText(message));
      const script = parseBoardScript(json, knownElementIds);
      // Tolerant reader, strict writer: a generated lesson MUST ship its quiz, so
      // a missing one is a generation miss we retry rather than a lesson we serve.
      if (!script.quiz) throw new Error('missing required `quiz` array (§8.4)');
      // Not just "valid JSON": the narration must actually be in the requested
      // language and the board text in English (§8.7) before we accept it.
      const langIssue = scriptLanguageIssue(script, input.language);
      if (langIssue) throw new Error(langIssue);
      return { script, attempts: attempt };
    } catch (error) {
      lastError = error;
      correction = `\n\nYour previous output was invalid: ${(error as Error).message}. Return ONLY the corrected JSON board script.`;
    }
  }

  throw new Error(`lesson generation failed after ${MAX_ATTEMPTS} attempts: ${String(lastError)}`);
}
