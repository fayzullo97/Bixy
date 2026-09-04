import type { MessagesClient } from '../generation/anthropic';

// Fill-in-the-blank grading (§8.11), reused by both the end-of-topic quiz (§8.4)
// and the level check (Phase 6). A fast deterministic pass first — normalize the
// typed answer and check it against the question's predefined accepted-answers
// list — and only when nothing matches, a single cheap Claude call (Haiku tier)
// asking whether the answer is acceptable anyway. Deterministic and free for the
// common case; the model is reserved for the genuinely ambiguous residual.

// Only unambiguous contractions are expanded. Forms like "he's" (is/has) or "he'd"
// (would/had) are left alone on purpose — expanding them could flip the very grammar
// a question tests (has-vs-is), which the AI fallback is better placed to judge.
const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am',
  "you're": 'you are',
  "we're": 'we are',
  "they're": 'they are',
  "i've": 'i have',
  "you've": 'you have',
  "we've": 'we have',
  "they've": 'they have',
  "i'll": 'i will',
  "you'll": 'you will',
  "he'll": 'he will',
  "she'll": 'she will',
  "it'll": 'it will',
  "we'll": 'we will',
  "they'll": 'they will',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "hasn't": 'has not',
  "haven't": 'have not',
  "hadn't": 'had not',
  "doesn't": 'does not',
  "don't": 'do not',
  "didn't": 'did not',
  "won't": 'will not',
  "wouldn't": 'would not',
  "can't": 'cannot',
  "couldn't": 'could not',
  "shouldn't": 'should not',
  "mustn't": 'must not',
};

/**
 * Canonical form for comparison: lowercase, straightened apostrophes, expanded
 * (unambiguous) contractions, punctuation stripped, whitespace collapsed. Applied
 * to BOTH the typed answer and each accepted answer so surface differences
 * ("I've visited" vs "I have visited") compare equal.
 */
export function normalizeAnswer(raw: string): string {
  const lowered = raw.toLowerCase().replace(/[‘’ʼ`´]/g, "'").trim();
  const expanded = lowered
    .split(/\s+/)
    .map((token) => {
      const core = token.replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, '');
      return CONTRACTIONS[core] ?? token;
    })
    .join(' ');
  return expanded
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The deterministic first pass: does the answer match any accepted form? */
export function matchesAccepted(answer: string, accepted: string[]): boolean {
  const norm = normalizeAnswer(answer);
  if (norm === '') return false;
  return accepted.some((a) => normalizeAnswer(a) === norm);
}

export interface GradeDeps {
  anthropic: MessagesClient;
  model: string;
}

export interface FillInQuestion {
  question: string;
  accepted_answers: string[];
}

export type GradeMethod = 'exact' | 'ai';
export interface GradeResult {
  correct: boolean;
  /** How the verdict was reached — 'exact' for the deterministic pass, 'ai' for the fallback. */
  method: GradeMethod;
}

function extractText(message: { content: Array<{ type: string; text?: string }> }): string {
  return message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('');
}

/** The AI fallback (§8.11): a single yes/no grammaticality judgment. */
async function aiJudge(deps: GradeDeps, question: FillInQuestion, answer: string): Promise<boolean> {
  const message = await deps.anthropic.messages.create({
    model: deps.model,
    max_tokens: 5,
    messages: [
      {
        role: 'user',
        content: `You are grading one fill-in-the-blank English grammar answer.

Question: ${question.question}
Accepted answers: ${question.accepted_answers.join(' | ')}
Student's answer: ${answer}

Is the student's answer acceptable — a valid alternate phrasing of an accepted answer, or a spelling typo that does not change the grammar being tested? A different tense or a grammatically wrong form is NOT acceptable. Reply with exactly YES or NO.`,
      },
    ],
  });
  return extractText(message).trim().toUpperCase().startsWith('Y');
}

/**
 * Grade a fill-in-the-blank answer: deterministic accepted-answers check first,
 * AI judgment only for what doesn't match. An empty answer is always wrong and
 * never reaches the model.
 */
export async function gradeFillIn(
  deps: GradeDeps,
  question: FillInQuestion,
  answer: string,
): Promise<GradeResult> {
  if (!answer.trim()) return { correct: false, method: 'exact' };
  if (matchesAccepted(answer, question.accepted_answers)) return { correct: true, method: 'exact' };
  return { correct: await aiJudge(deps, question, answer), method: 'ai' };
}
