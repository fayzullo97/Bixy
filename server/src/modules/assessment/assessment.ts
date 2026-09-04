import type { MessagesClient } from '../generation/anthropic';
import { gradeFillIn, type FillInQuestion, type GradeResult } from './grading';

/**
 * Grades fill-in-the-blank answers for the quiz (§8.4) and, later, the level
 * check (§8.11). The whole board script — including answers — already lives on
 * the client (same as check-in `correct_index`), so this service does not exist
 * to hide answers; it exists so the AI fallback in the grader runs server-side
 * with the Claude API key, not in the browser.
 */
export interface AssessmentService {
  gradeFillIn(question: FillInQuestion, answer: string): Promise<GradeResult>;
}

export interface AssessmentDeps {
  anthropic: MessagesClient;
  model: string;
}

export function createAssessmentService(deps: AssessmentDeps): AssessmentService {
  return {
    gradeFillIn: (question, answer) =>
      gradeFillIn({ anthropic: deps.anthropic, model: deps.model }, question, answer),
  };
}
