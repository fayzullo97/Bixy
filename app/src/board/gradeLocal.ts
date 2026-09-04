// Offline fallback for grading fill-in-the-blank answers when no server-backed
// grader is supplied (e.g. the static §8.2 sample played without a session). It
// mirrors the deterministic first pass of the server grader (§8.11) — normalize,
// then accepted-answers lookup — but has no AI fallback, which needs the server.
// The real signed-in/generated flow passes api.gradeFillIn instead of this.

const CONTRACTIONS: Record<string, string> = {
  "i'm": 'i am',
  "you're": 'you are',
  "we're": 'we are',
  "they're": 'they are',
  "i've": 'i have',
  "you've": 'you have',
  "we've": 'we have',
  "they've": 'they have',
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
  "can't": 'cannot',
};

function normalize(raw: string): string {
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

/** Deterministic accepted-answers check (no AI fallback). */
export function gradeFillInLocally(acceptedAnswers: string[], answer: string): boolean {
  const norm = normalize(answer);
  if (norm === '') return false;
  return acceptedAnswers.some((a) => normalize(a) === norm);
}
