import { Platform } from 'react-native';
import type { Lang } from '../i18n';
import type { BoardScript, QuizQuestion } from '../board/types';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// Safety net for a *stuck* generation (§8.10) — not a target for a normal first
// generation, which legitimately takes tens of seconds. Generous, and only trips
// when the model never responds. Env-overridable for slow networks.
const LESSON_TIMEOUT_MS = Number(process.env.EXPO_PUBLIC_LESSON_TIMEOUT_MS ?? 120000);

/** fetch with an abort-based timeout; a trip surfaces as an AbortError. */
async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export interface UserDto {
  telegramId: string;
  name: string | null;
  username: string | null;
  photoUrl: string | null;
  appLanguage: Lang;
  /** When Bixy first introduced itself (Part 05 §7); null if it hasn't yet.
   *  Part 07 §12's greeting carries the introduction while this is null. */
  metAt: string | null;
}

export interface AuthResult {
  session: string;
  user: UserDto;
}

/** One level-check question (§8.11), as served to the client's adaptive test. */
export interface LevelCheckQuestion {
  id: string;
  topic_id: string;
  level: string;
  prompt: string;
  accepted_answers: string[];
}

export interface LevelStats {
  level: string;
  completed: number;
  total: number;
}

/** The study plan + the topic to serve next + the dashboard stat (§8.12). */
export interface StudyPlan {
  level: string;
  ordered_topic_ids: string[];
  current_position: number;
  current_topic_id: string | null;
  stats: LevelStats;
}

/** A topic's state on the level map (Part 07 §9). Only `passed`, `current` and
 *  `started` are openable — `locked` sits past the path's frontier. */
export type TopicStatus = 'passed' | 'started' | 'current' | 'locked';

/** A tier's state in the All Levels grid (Part 07 §9). */
export type LevelStatus = 'completed' | 'in_progress' | 'not_started';

export interface LevelSummary {
  level: string;
  status: LevelStatus;
  completed: number;
  total: number;
}

/** The All Levels grid (Part 07 §9). */
export interface LevelMap {
  levels: LevelSummary[];
  placement: string | null;
}

export interface LevelTopic {
  topic_id: string;
  status: TopicStatus;
  key_idea: string | null;
}

/** One level's screen (Part 07 §9); `scroll_to` is non-null only for the
 *  student's own current level. */
export interface LevelDetail {
  level: string;
  topics: LevelTopic[];
  scroll_to: number | null;
}

/** The arrival stage (§8.12, Part 05 §7). `first_meeting` fires once, ever. */
export type GreetingVariant = 'full' | 'short' | 'first_meeting';

/** What the student told Bixy when they met (Part 05 §7) — all optional. */
export interface StudentProfile {
  occupation?: string;
  study_place?: string;
  hobbies?: string;
  interests?: string;
  motivation?: string;
}

/** One topic's saved progress (§8.9) — drives mid-lesson resume (§9.1). */
export interface ProgressRecord {
  topic_id: string;
  status: 'started' | 'passed';
  quiz_score: number | null;
  last_completed_beat: number | null;
  mastered: boolean;
  /** Part 04 §6 — retests already failed, and what was missed last time. */
  retest_round?: number;
  missed_fingerprints?: string[];
}

/** What a submitted input (§8.5) resolved to: a full lesson (a detour to a new
 *  topic, or a photo's topic), an appended re-explanation, or off-topic. */
export type AskResult =
  | { kind: 'lesson'; topic_id: string; board_script: BoardScript; cached: boolean }
  | { kind: 'reexplain'; beats: BoardScript['beats'] }
  /** "Are you real?", answered in character (Part 05 §8). */
  | { kind: 'identity'; text: string }
  | { kind: 'no_content' };

async function postJson<T>(path: string, body: unknown, session?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  /** Restore a persisted session on load (§8.8). */
  async me(session: string): Promise<UserDto> {
    const res = await fetch(`${API_URL}/me`, {
      headers: { Authorization: `Bearer ${session}` },
    });
    if (!res.ok) throw new Error(`me failed: ${res.status}`);
    return ((await res.json()) as { user: UserDto }).user;
  },

  /**
   * Exchange a verified Telegram Mini App `initData` string for a session (§8.8).
   * `appLanguage` is optional — when omitted the server derives it from the
   * Telegram user's language_code (or keeps a returning student's saved choice).
   */
  telegramLogin(initData: string, appLanguage?: Lang): Promise<AuthResult> {
    return postJson<AuthResult>('/auth/telegram', {
      init_data: initData,
      ...(appLanguage ? { app_language: appLanguage } : {}),
    });
  },

  /** DEV ONLY — bypasses Telegram, used for local runs until the URL is registered. */
  devLogin(appLanguage: Lang): Promise<AuthResult> {
    return postJson<AuthResult>('/auth/dev-login', { app_language: appLanguage });
  },

  /**
   * Generate (or fetch a cached) lesson (§8.1/§9.2). Throws 'no_content' when
   * off-topic, 'timeout' when the model never responds (§8.10), or a generic
   * error on a failed request — the board screen classifies these for the student.
   */
  async generateLesson(
    session: string,
    body: { topic_id?: string; text?: string; language: Lang },
  ): Promise<{ board_script: BoardScript; cached: boolean }> {
    let res: Response;
    try {
      res = await fetchWithTimeout(
        `${API_URL}/lessons`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
          body: JSON.stringify(body),
        },
        LESSON_TIMEOUT_MS,
      );
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new Error('timeout');
      throw e;
    }
    if (res.status === 404) throw new Error('no_content');
    if (!res.ok) throw new Error(`lesson failed: ${res.status}`);
    return res.json() as Promise<{ board_script: BoardScript; cached: boolean }>;
  },

  /**
   * The shorter retest after a failed topic test (Part 04 §6). The server picks
   * the questions from the student's own persisted misses plus the topic's
   * variant pool — the client doesn't choose, and doesn't need to.
   */
  async retest(
    session: string,
    body: { topic_id: string; language: Lang },
  ): Promise<{ quiz: QuizQuestion[]; retest_round: number }> {
    const res = await fetchWithTimeout(
      `${API_URL}/lessons/retest`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
        body: JSON.stringify(body),
      },
      LESSON_TIMEOUT_MS,
    );
    if (!res.ok) throw new Error(`retest failed: ${res.status}`);
    return res.json() as Promise<{ quiz: QuizQuestion[]; retest_round: number }>;
  },

  /**
   * The check-in closing out a detour (Part 04 §13). A null question means the
   * topic has nothing pooled yet — the board then returns without one.
   */
  async wrapUp(
    session: string,
    body: { topic_id: string; language: Lang },
  ): Promise<{ question: QuizQuestion | null }> {
    const res = await fetchWithTimeout(
      `${API_URL}/lessons/wrap-up`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
        body: JSON.stringify(body),
      },
      LESSON_TIMEOUT_MS,
    );
    if (!res.ok) throw new Error(`wrap-up failed: ${res.status}`);
    return res.json() as Promise<{ question: QuizQuestion | null }>;
  },

  /**
   * The single input (§8.5): a typed request or an attached photo, resolved
   * against the current lesson. Returns a new lesson (a detour or the photo's
   * topic), an appended re-explanation, or no_content when it's off the grammar
   * path. Same generous timeout as generateLesson, since a detour also generates.
   */
  async ask(
    session: string,
    body: {
      text?: string;
      image?: { base64: string; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' };
      language: Lang;
      current_topic_id?: string | null;
    },
  ): Promise<AskResult> {
    let res: Response;
    try {
      res = await fetchWithTimeout(
        `${API_URL}/lessons/ask`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
          body: JSON.stringify(body),
        },
        LESSON_TIMEOUT_MS,
      );
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw new Error('timeout');
      throw e;
    }
    if (!res.ok) throw new Error(`ask failed: ${res.status}`);
    return res.json() as Promise<AskResult>;
  },

  /** All saved progress for the student (§8.9); used to find a topic's resume beat. */
  async getProgress(session: string): Promise<ProgressRecord[]> {
    const res = await fetch(`${API_URL}/progress`, {
      headers: { Authorization: `Bearer ${session}` },
    });
    if (!res.ok) throw new Error(`progress failed: ${res.status}`);
    return ((await res.json()) as { progress: ProgressRecord[] }).progress;
  },

  /** Grade one fill-in-the-blank quiz answer (§8.11). MC/TF are graded client-side. */
  async gradeFillIn(
    session: string,
    body: { question: string; accepted_answers: string[]; answer: string },
  ): Promise<{ correct: boolean; method: 'exact' | 'ai' }> {
    return postJson('/assessment/grade', body, session);
  },

  /** Incrementally persist lesson/quiz progress for one topic (§8.9). */
  async putProgress(
    session: string,
    topicId: string,
    patch: {
      status?: 'started' | 'passed';
      quiz_score?: number | null;
      last_completed_beat?: number | null;
      mastered?: boolean;
    },
  ): Promise<void> {
    await fetch(`${API_URL}/progress/${encodeURIComponent(topicId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
      body: JSON.stringify(patch),
    }).catch(() => {
      // Best-effort; progress saving must never interrupt the lesson.
    });
  },

  /** The level-check bank + this student's seen ids + current placement (§8.11). */
  async getLevelCheck(
    session: string,
  ): Promise<{ questions: LevelCheckQuestion[]; seen: string[]; placement: string | null }> {
    const res = await fetch(`${API_URL}/level-check`, {
      headers: { Authorization: `Bearer ${session}` },
    });
    if (!res.ok) throw new Error(`level-check failed: ${res.status}`);
    return res.json() as Promise<{
      questions: LevelCheckQuestion[];
      seen: string[];
      placement: string | null;
    }>;
  },

  /** Record that a level-check question was shown — best-effort (§8.11 Retaking). */
  async postLevelCheckSeen(session: string, questionId: string): Promise<void> {
    await fetch(`${API_URL}/level-check/seen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
      body: JSON.stringify({ question_id: questionId }),
    }).catch(() => {
      // Best-effort; seen-tracking must never interrupt the test.
    });
  },

  /** Persist the level a completed attempt landed on (§8.11). */
  async putLevelCheckPlacement(session: string, level: string): Promise<void> {
    await fetch(`${API_URL}/level-check/placement`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
      body: JSON.stringify({ level }),
    }).catch(() => {
      // Best-effort; the on-screen result still shows the placement.
    });
  },

  /** The student's study plan, or null if they haven't been placed yet (§8.12). */
  async getStudyPlan(session: string): Promise<StudyPlan | null> {
    const res = await fetch(`${API_URL}/study-plan`, {
      headers: { Authorization: `Bearer ${session}` },
    });
    if (!res.ok) throw new Error(`study-plan failed: ${res.status}`);
    return ((await res.json()) as { plan: StudyPlan | null }).plan;
  },

  /** Advance the path after clearing a topic (§8.12); returns the updated plan. */
  async advanceStudyPlan(session: string, topicId: string): Promise<StudyPlan | null> {
    const res = await fetch(`${API_URL}/study-plan/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
      body: JSON.stringify({ topic_id: topicId }),
    });
    if (!res.ok) throw new Error(`advance failed: ${res.status}`);
    return ((await res.json()) as { plan: StudyPlan | null }).plan;
  },

  /** Which greeting to show now, stamping the greeting time (§8.12). */
  async postGreeting(session: string): Promise<GreetingVariant> {
    const res = await fetch(`${API_URL}/me/greeting`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session}` },
    });
    if (!res.ok) throw new Error(`greeting failed: ${res.status}`);
    return ((await res.json()) as { variant: GreetingVariant }).variant;
  },

  /**
   * Close the first meeting (Part 05 §7) — sent when the student finishes the
   * get-to-know-you or skips it. Both end the meeting for good, so this is sent
   * either way; a skip simply carries no answers.
   */
  async postProfile(session: string, answers: StudentProfile): Promise<void> {
    await fetch(`${API_URL}/me/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
      body: JSON.stringify({ answers }),
    }).catch(() => {
      // Best-effort. A lost answer set is a smaller harm than blocking a student
      // at the door of their first lesson.
    });
  },

  /**
   * Speaks the greeting screen's text (Part 07 §12 step 2) — exactly the string
   * already on screen, so what's said always matches what's shown. Returns a
   * playable blob URL, or null when there's nothing to play: off-web (native
   * has no `Blob`/`Audio` path here, matching `playNarration`'s own web-only
   * gate), no TTS provider configured server-side, or the request itself
   * failed. Every case is a silent skip, never a blocking error — a missing
   * voice is a smaller harm than stalling a student at the door of their
   * first lesson.
   */
  async getGreetingAudio(session: string, text: string): Promise<string | null> {
    if (Platform.OS !== 'web') return null;
    try {
      const res = await fetch(`${API_URL}/me/greeting-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  },

  /**
   * Set the student's UI language (Part 07 §12). Asked as onboarding step 1,
   * so this is a separate call rather than part of sign-in. Returns the updated
   * user so the client doesn't have to guess what the server stored.
   */
  async setLanguage(session: string, language: Lang): Promise<UserDto> {
    const res = await fetch(`${API_URL}/me/language`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session}` },
      body: JSON.stringify({ language }),
    });
    if (!res.ok) throw new Error(`language failed: ${res.status}`);
    return ((await res.json()) as { user: UserDto }).user;
  },

  /** Every tier with its counts, for the All Levels grid (Part 07 §9). */
  async getLevels(session: string): Promise<LevelMap> {
    const res = await fetch(`${API_URL}/levels`, {
      headers: { Authorization: `Bearer ${session}` },
    });
    if (!res.ok) throw new Error(`levels failed: ${res.status}`);
    return res.json() as Promise<LevelMap>;
  },

  /** One tier's topics in path order, plus where its screen opens (Part 07 §9). */
  async getLevel(session: string, level: string): Promise<LevelDetail> {
    const res = await fetch(`${API_URL}/levels/${encodeURIComponent(level)}`, {
      headers: { Authorization: `Bearer ${session}` },
    });
    if (!res.ok) throw new Error(`level failed: ${res.status}`);
    return res.json() as Promise<LevelDetail>;
  },

  async signOut(session: string): Promise<void> {
    await fetch(`${API_URL}/auth/signout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session}` },
    }).catch(() => {
      // Best-effort; the client clears its own token regardless.
    });
  },
};
