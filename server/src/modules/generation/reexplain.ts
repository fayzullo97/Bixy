import type Anthropic from '@anthropic-ai/sdk';
import type { MessagesClient } from './anthropic.js';
import { extractText, parseJsonLoose } from './generateLesson.js';
import { parseBoardScript, type Beat } from './boardScript.js';
import { scriptLanguageIssue } from './languageCheck.js';
import type { Language } from './systemPrompt.js';
import type { DoodleCatalogEntry, TopicOutline } from '../content/content.repo.js';

const MAX_ATTEMPTS = 2;

const LANGUAGE_NAMES: Record<Language, string> = { en: 'English', uz: 'Uzbek', ru: 'Russian' };

export interface ReexplainDeps {
  anthropic: MessagesClient;
  model: string;
  doodles: DoodleCatalogEntry[];
}

/**
 * The re-explanation system prompt (§8.5): same persona, beat shapes, language
 * rule (§8.7) and doodle catalog as a lesson, but the task is a SHORT alternate
 * explanation of one point — a continuation of the current lesson, no quiz, no
 * title. Kept as a cached block so it doesn't re-bill on every follow-up.
 */
function buildReexplainSystem(doodles: DoodleCatalogEntry[]): string {
  const catalog = doodles.map((d) => `- ${d.id} (${d.category}): ${d.description}`).join('\n');
  return `You are Bixy, an AI whiteboard tutor for English grammar. A student is mid-lesson and asked a follow-up — to go over part of it again a different way, or a specific question about what's on the board. Produce a SHORT board segment that answers, as a continuation of the current lesson (never a new full lesson).

# Output
A JSON object: { "beats": [ ... ] } — 2 to 5 beats, NO quiz, NO title. Same beat shapes as a lesson:
- story_beat: { "id": int, "type": "story_beat", "narration": string, "doodles": [ { "element_id": string, "position"?: "left"|"center"|"right", "attached_to"?: string, "text"?: string } ] }
- formal_beat: { "id": int, "type": "formal_beat", "style": "explanation"|"example"|"common_mistake"|"formula"|"recap_example", "content": string, "emphasis"?: string }
Ids are 1-based and sequential within this segment.

# Approach
- Answer the specific thing asked, in a genuinely DIFFERENT angle or wording than a plain repeat — the student didn't follow it the first way.
- Keep it tight: clarify the one point, don't re-teach the whole topic.
- At least one story_beat carrying the spoken explanation; add a formal_beat only if writing it helps.

# Language (critical)
The ONLY field in the student's narration language is each story_beat "narration". EVERYTHING written on the board (formal beat content/emphasis, any bubble text) stays in English — it is the target-language material the student is learning.

# Rules
- doodles[].element_id MUST be one of the catalog ids below — never invent artwork.
- Keep each narration under ~500 characters.
- Output ONLY the JSON object — no prose, no markdown fences.

# Doodle catalog
${catalog}`;
}

function buildReexplainUser(topic: TopicOutline, language: Language, question: string): string {
  return `The student is in the lesson on "${topic.topic_id}" (${topic.level}). Reference outline (your grounding — don't drift):
${JSON.stringify(topic, null, 2)}

Narration language: ${LANGUAGE_NAMES[language]} (${language}) — only story_beat "narration" is in it; everything written on the board stays English.

The student asked: "${question}"

Produce the { "beats": [...] } segment that answers this. Output only the JSON.`;
}

/**
 * Generates a short re-explanation segment for a follow-up (§8.5), grounded in the
 * topic outline and the student's question. Validated with the same beat rules as
 * a lesson (wrapped in a minimal script) plus the §8.7 language check; a miss is
 * fed back and retried, and a failed call is retried, within a small budget.
 */
export async function generateReexplanation(
  deps: ReexplainDeps,
  input: { topic: TopicOutline; language: Language; question: string },
): Promise<{ beats: Beat[] }> {
  const system = buildReexplainSystem(deps.doodles);
  const knownElementIds = new Set(deps.doodles.map((d) => d.id));
  const user = buildReexplainUser(input.topic, input.language, input.question);

  let correction = '';
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let message: Anthropic.Message;
    try {
      message = await deps.anthropic.messages.create({
        model: deps.model,
        max_tokens: 2000,
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: user + correction }],
      });
    } catch (error) {
      lastError = error;
      continue;
    }

    try {
      const json = parseJsonLoose(extractText(message)) as { beats?: unknown };
      // Validate the beats by wrapping them in a minimal, quiz-less script.
      const script = parseBoardScript(
        { topic_id: input.topic.topic_id, level: input.topic.level, beats: json.beats },
        knownElementIds,
      );
      const langIssue = scriptLanguageIssue(script, input.language);
      if (langIssue) throw new Error(langIssue);
      return { beats: script.beats };
    } catch (error) {
      lastError = error;
      correction = `\n\nYour previous output was invalid: ${(error as Error).message}. Return ONLY the corrected JSON { "beats": [...] }.`;
    }
  }

  throw new Error(`re-explanation failed after ${MAX_ATTEMPTS} attempts: ${String(lastError)}`);
}
