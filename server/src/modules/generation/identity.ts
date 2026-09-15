import type Anthropic from '@anthropic-ai/sdk';
import type { MessagesClient } from './anthropic.js';
import type { Language } from './systemPrompt.js';
import { deflectionPrompt } from './persona.js';

function firstText(message: Anthropic.Message): string {
  const block = message.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  return (block?.text ?? '').trim();
}

const CLASSIFY_SYSTEM =
  'You decide one thing about a message a student sent to an AI tutor: is the student asking about the TUTOR ITSELF — ' +
  'whether it is real, human, a bot, an AI, a program, who or what it is, who made it? ' +
  'Answer YES for any phrasing of that question, including indirect ones ("am I talking to a person?", "is there someone there?"). ' +
  'Answer NO for everything else, including English-grammar questions, requests for a topic, and questions about the lesson on screen. ' +
  'Reply with ONLY the word YES or NO.';

/**
 * Whether a message is asking Bixy what it is (Part 05 §8).
 *
 * A model call rather than keyword matching, deliberately: the question arrives
 * paraphrased far more often than literally ("are you a bot", "am I talking to a
 * person", "is this a real teacher"), and a pattern list that catches those
 * without also swallowing ordinary grammar questions doesn't exist. The spec
 * accepts the added per-message latency and cost as the price of that.
 *
 * Runs on a cheap model with a 5-token budget, and fails OPEN — a classifier
 * error means "not an identity question", so a blip costs a deflection, never a
 * blocked lesson request.
 */
export async function isIdentityQuestion(
  anthropic: MessagesClient,
  model: string,
  text: string,
): Promise<boolean> {
  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 5,
      system: CLASSIFY_SYSTEM,
      messages: [{ role: 'user', content: `Message: "${text}"\n\nYES or NO?` }],
    });
    return firstText(message).toUpperCase().startsWith('YES');
  } catch (error) {
    console.error('[identity] classification failed:', (error as Error).message);
    return false;
  }
}

/**
 * Bixy's in-character answer to an identity question (Part 05 §8), in the
 * student's language. Generated rather than canned so it varies and sounds like
 * the same tutor, with a fixed fallback line if the call fails — the one thing
 * that must not happen here is falling through to "I don't have information
 * about that", which reads as the tutor dodging the question.
 */
const FALLBACK: Record<Language, string> = {
  en: "I'm Bixy — not a person, but I'm really here, and I'm good at grammar. Shall we get back to it?",
  uz: "Men Bixy — odam emasman, lekin shu yerdaman va grammatikani yaxshi bilaman. Davom etamizmi?",
  ru: 'Я Бикси — не человек, но я правда здесь и хорошо знаю грамматику. Вернёмся к теме?',
};

export async function deflectIdentity(
  anthropic: MessagesClient,
  model: string,
  text: string,
  language: Language,
): Promise<string> {
  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: 200,
      system: deflectionPrompt(language),
      messages: [{ role: 'user', content: text }],
    });
    const reply = firstText(message);
    return reply || FALLBACK[language];
  } catch (error) {
    console.error('[identity] deflection failed:', (error as Error).message);
    return FALLBACK[language];
  }
}
