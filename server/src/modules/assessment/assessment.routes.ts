import { Router } from 'express';
import type { AppDeps } from '../../deps.js';
import { requireAuth } from '../../middleware/requireAuth.js';
import type { FillInQuestion } from './grading.js';

/** Pull a well-typed fill-in-the-blank grading request out of the body. */
function parseGradeBody(body: unknown): { question: FillInQuestion; answer: string } | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.question !== 'string' || b.question.trim() === '') return null;
  if (
    !Array.isArray(b.accepted_answers) ||
    b.accepted_answers.length === 0 ||
    b.accepted_answers.some((a) => typeof a !== 'string')
  ) {
    return null;
  }
  if (typeof b.answer !== 'string') return null;
  return {
    question: { question: b.question, accepted_answers: b.accepted_answers as string[] },
    answer: b.answer,
  };
}

export function assessmentRoutes(deps: AppDeps): Router {
  const router = Router();

  // Grade one fill-in-the-blank answer (§8.11). Authed — it can spend a model call.
  router.post('/grade', requireAuth(deps.session), async (req, res) => {
    const parsed = parseGradeBody(req.body);
    if (parsed === null) {
      res.status(400).json({ error: 'question, accepted_answers[], and answer are required' });
      return;
    }
    const result = await deps.assessment.gradeFillIn(parsed.question, parsed.answer);
    res.json(result);
  });

  return router;
}
