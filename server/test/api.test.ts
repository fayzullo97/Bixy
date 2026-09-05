import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/createApp';
import { makeSession } from '../src/modules/auth/session';
import type { InitDataVerifier } from '../src/modules/auth/verifyInitData';
import type { UpsertUserInput, UserRecord, UsersRepo } from '../src/modules/users/users.repo';
import type {
  ProgressPatch,
  ProgressRecord,
  ProgressRepo,
} from '../src/modules/progress/progress.repo';
import type { ContentRepo } from '../src/modules/content/content.repo';
import type { LessonService } from '../src/modules/generation/pipeline';
import type { AssessmentService } from '../src/modules/assessment/assessment';
import type { LevelCheckQuestion, LevelCheckRepo } from '../src/modules/level-check/levelCheck.repo';
import type { StudyPlanRecord, StudyPlanRepo } from '../src/modules/study-plan/studyPlan.repo';
import { createStudyPlanService } from '../src/modules/study-plan/studyPlan.service';

// ---- In-memory fakes (no live Telegram or Supabase needed) -------------------

function fakeUsersRepo() {
  const store = new Map<string, UserRecord>();
  const repo: UsersRepo = {
    async upsert(input: UpsertUserInput) {
      const now = new Date().toISOString();
      const prev = store.get(input.telegramId);
      const record: UserRecord = {
        telegram_id: input.telegramId,
        name: input.name,
        username: input.username,
        photo_url: input.photoUrl,
        app_language: input.appLanguage,
        created_at: prev?.created_at ?? now,
        updated_at: now,
      };
      store.set(record.telegram_id, record);
      return record;
    },
    async get(telegramId: string) {
      return store.get(telegramId) ?? null;
    },
    async getLastGreetedAt(telegramId: string) {
      return store.get(telegramId)?.last_greeted_at ?? null;
    },
    async setLastGreetedAt(telegramId: string, iso: string) {
      const prev = store.get(telegramId);
      if (prev) store.set(telegramId, { ...prev, last_greeted_at: iso });
    },
  };
  return { repo, store };
}

function fakeProgressRepo() {
  const store = new Map<string, ProgressRecord>();
  const key = (t: string, topic: string) => `${t}:${topic}`;
  const repo: ProgressRepo = {
    async listForUser(telegramId: string) {
      return [...store.values()].filter((r) => r.telegram_id === telegramId);
    },
    async upsert(telegramId: string, topicId: string, patch: ProgressPatch) {
      const prev = store.get(key(telegramId, topicId));
      const record: ProgressRecord = {
        telegram_id: telegramId,
        topic_id: topicId,
        status: patch.status ?? prev?.status ?? 'started',
        quiz_score: patch.quiz_score ?? prev?.quiz_score ?? null,
        last_completed_beat: patch.last_completed_beat ?? prev?.last_completed_beat ?? null,
        mastered: patch.mastered ?? prev?.mastered ?? false,
        updated_at: new Date().toISOString(),
      };
      store.set(key(telegramId, topicId), record);
      return record;
    },
  };
  return { repo, store };
}

const verifyInitData: InitDataVerifier = async (initData: string) => {
  if (initData === 'valid-init-data') {
    return {
      telegramId: '42',
      name: 'Test Student',
      username: 'test',
      photoUrl: null,
      languageCode: 'ru',
    };
  }
  throw new Error('invalid init data');
};

const fakeContent: ContentRepo = {
  async upsertTopics() {
    return 0;
  },
  async upsertDoodles() {
    return 0;
  },
  async countTopics() {
    return 0;
  },
  async countDoodles() {
    return 0;
  },
  async listDoodles() {
    return [
      { id: 'person_a', category: 'people', description: 'Figure', url: 'https://x.test/person_a.svg' },
    ];
  },
  async getTopic() {
    return null;
  },
  async listTopicsCompact() {
    return [];
  },
  // A small set spanning A1→A2 so the study plan has a real sequence to order.
  // Deliberately out of authored order + interleaved families to exercise the
  // sort_order grouping and the comparative-before-superlative pin.
  async listTopicsForPlan() {
    return [
      { topic_id: 'articles_a_an', level: 'A1', sort_order: 2 },
      { topic_id: 'present_simple', level: 'A1', sort_order: 1 },
      { topic_id: 'present_simple_be', level: 'A1', sort_order: 0 },
      { topic_id: 'superlative_adjectives', level: 'A2', sort_order: 5 },
      { topic_id: 'comparative_adjectives', level: 'A2', sort_order: 4 },
      { topic_id: 'past_simple', level: 'A2', sort_order: 3 },
    ];
  },
};

const fakeLessons: LessonService = {
  async getLesson(request) {
    if (request.topicId === 'unknown_topic') return { ok: false, error: 'not_found' };
    return {
      ok: true,
      cached: false,
      boardScript: {
        topic_id: request.topicId ?? 'x',
        level: 'A2',
        beats: [{ id: 1, type: 'formal_beat', style: 'title', content: 'Present Perfect' }],
      },
    };
  },
  async ask(request) {
    if (request.text === 'reexplain') return { kind: 'reexplain', beats: [] };
    if (request.text === 'nope') return { kind: 'no_content' };
    return {
      kind: 'lesson',
      topicId: request.text ?? 'x',
      cached: false,
      boardScript: { topic_id: request.text ?? 'x', level: 'A2', beats: [{ id: 1, type: 'formal_beat', style: 'title', content: 'T' }] },
    };
  },
};

// Deterministic fake: the exact accepted-answers match is the "correct" case; the
// route wiring is what's under test here, not the grader (that has its own suite).
const fakeAssessment: AssessmentService = {
  async gradeFillIn(question, answer) {
    const correct = question.accepted_answers.some(
      (a) => a.trim().toLowerCase() === answer.trim().toLowerCase(),
    );
    return { correct, method: 'exact' };
  },
};

function fakeLevelCheckRepo() {
  const questions: LevelCheckQuestion[] = [
    { id: 'present_simple_be', topic_id: 'present_simple_be', level: 'A1', prompt: 'Bekzod ___ an engineer.', accepted_answers: ['is'] },
    { id: 'past_simple', topic_id: 'past_simple', level: 'B1', prompt: 'She ___ (go) yesterday.', accepted_answers: ['went'] },
  ];
  const seen = new Map<string, Set<string>>();
  const placements = new Map<string, string>();
  const repo: LevelCheckRepo = {
    async listQuestions() {
      return questions;
    },
    async listSeen(telegramId: string) {
      return [...(seen.get(telegramId) ?? new Set<string>())];
    },
    async markSeen(telegramId: string, questionId: string) {
      const set = seen.get(telegramId) ?? new Set<string>();
      set.add(questionId);
      seen.set(telegramId, set);
    },
    async getPlacement(telegramId: string) {
      return placements.get(telegramId) ?? null;
    },
    async setPlacement(telegramId: string, level: string) {
      placements.set(telegramId, level);
    },
    async upsertQuestions() {
      return questions.length;
    },
  };
  return { repo, seen, placements };
}

function fakeStudyPlanRepo() {
  const store = new Map<string, StudyPlanRecord>();
  const repo: StudyPlanRepo = {
    async get(telegramId: string) {
      return store.get(telegramId) ?? null;
    },
    async replace(telegramId: string, level: string, orderedTopicIds: string[]) {
      const record: StudyPlanRecord = {
        telegram_id: telegramId,
        level,
        ordered_topic_ids: orderedTopicIds,
        current_position: 0,
      };
      store.set(telegramId, record);
      return record;
    },
    async setPosition(telegramId: string, position: number) {
      const prev = store.get(telegramId);
      if (prev) store.set(telegramId, { ...prev, current_position: position });
    },
  };
  return { repo, store };
}

function buildApp() {
  const users = fakeUsersRepo();
  const progress = fakeProgressRepo();
  const levelCheck = fakeLevelCheckRepo();
  const plans = fakeStudyPlanRepo();
  const session = makeSession({ secret: 'test-secret-please-ignore', ttlDays: 30 });
  const app = createApp({
    corsOrigin: '*',
    verifyInitData,
    session,
    users: users.repo,
    progress: progress.repo,
    content: fakeContent,
    lessons: fakeLessons,
    assessment: fakeAssessment,
    levelCheck: levelCheck.repo,
    studyPlan: createStudyPlanService({
      content: fakeContent,
      progress: progress.repo,
      plans: plans.repo,
    }),
  });
  return { app, users, progress, levelCheck, plans };
}

async function signIn(app: ReturnType<typeof buildApp>['app'], language = 'uz') {
  const res = await request(app)
    .post('/auth/telegram')
    .send({ init_data: 'valid-init-data', app_language: language });
  return res;
}

// ---- Tests -------------------------------------------------------------------

describe('POST /auth/telegram', () => {
  it('validates the initData, creates the user, and returns a session', async () => {
    const { app, users } = buildApp();
    const res = await signIn(app, 'uz');

    expect(res.status).toBe(200);
    expect(typeof res.body.session).toBe('string');
    expect(res.body.user).toMatchObject({
      telegramId: '42',
      name: 'Test Student',
      username: 'test',
      appLanguage: 'uz',
    });
    expect(users.store.get('42')).toBeDefined();
  });

  it('derives the app language from Telegram when none is provided', async () => {
    const { app } = buildApp();
    // The fake verifier reports languageCode 'ru' for a new user.
    const res = await request(app).post('/auth/telegram').send({ init_data: 'valid-init-data' });
    expect(res.status).toBe(200);
    expect(res.body.user.appLanguage).toBe('ru');
  });

  it('preserves a returning student’s saved language over a new request', async () => {
    const { app } = buildApp();
    // First sign-in picks 'uz' explicitly.
    await signIn(app, 'uz');
    // A later sign-in with no language must NOT reset it to the derived 'ru'.
    const res = await request(app).post('/auth/telegram').send({ init_data: 'valid-init-data' });
    expect(res.status).toBe(200);
    expect(res.body.user.appLanguage).toBe('uz');
  });

  it('rejects invalid initData with 401', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/auth/telegram')
      .send({ init_data: 'forged', app_language: 'en' });
    expect(res.status).toBe(401);
  });

  it('requires an init_data string', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/auth/telegram').send({ app_language: 'en' });
    expect(res.status).toBe(400);
  });

  it('rejects an explicitly invalid app_language', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/auth/telegram')
      .send({ init_data: 'valid-init-data', app_language: 'fr' });
    expect(res.status).toBe(400);
  });
});

describe('GET /me', () => {
  it('returns 401 without a session', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/me');
    expect(res.status).toBe(401);
  });

  it('returns the signed-in student with a valid session', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;
    const res = await request(app).get('/me').set('Authorization', `Bearer ${session}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ telegramId: '42', appLanguage: 'uz' });
  });

  it('rejects a garbage session token', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/me').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });
});

describe('progress', () => {
  it('round-trips an incremental save keyed off the Telegram id', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;

    const put = await request(app)
      .put('/progress/present_perfect_tense')
      .set('Authorization', `Bearer ${session}`)
      .send({ status: 'started', last_completed_beat: 2 });
    expect(put.status).toBe(200);
    expect(put.body.progress).toMatchObject({
      telegram_id: '42',
      topic_id: 'present_perfect_tense',
      status: 'started',
      last_completed_beat: 2,
    });

    const list = await request(app).get('/progress').set('Authorization', `Bearer ${session}`);
    expect(list.status).toBe(200);
    expect(list.body.progress).toHaveLength(1);
    expect(list.body.progress[0].topic_id).toBe('present_perfect_tense');
  });

  it('rejects invalid progress fields', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;
    const res = await request(app)
      .put('/progress/present_perfect_tense')
      .set('Authorization', `Bearer ${session}`)
      .send({ status: 'nonsense' });
    expect(res.status).toBe(400);
  });

  it('requires auth', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/progress');
    expect(res.status).toBe(401);
  });
});

describe('GET /content/doodles', () => {
  it('returns the doodle catalog without requiring auth', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/content/doodles');
    expect(res.status).toBe(200);
    expect(res.body.doodles[0]).toMatchObject({
      id: 'person_a',
      url: expect.stringContaining('person_a.svg'),
    });
  });
});

describe('POST /lessons', () => {
  it('requires auth', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/lessons').send({ topic_id: 'present_perfect', language: 'uz' });
    expect(res.status).toBe(401);
  });

  it('requires a valid language', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;
    const res = await request(app)
      .post('/lessons')
      .set('Authorization', `Bearer ${session}`)
      .send({ topic_id: 'present_perfect', language: 'fr' });
    expect(res.status).toBe(400);
  });

  it('returns a board script for a known topic', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;
    const res = await request(app)
      .post('/lessons')
      .set('Authorization', `Bearer ${session}`)
      .send({ topic_id: 'present_perfect', language: 'uz' });
    expect(res.status).toBe(200);
    expect(res.body.board_script.beats[0]).toMatchObject({ style: 'title' });
  });

  it('answers "I don\'t have information" for an unresolved request', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;
    const res = await request(app)
      .post('/lessons')
      .set('Authorization', `Bearer ${session}`)
      .send({ topic_id: 'unknown_topic', language: 'uz' });
    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/don't have information/);
  });
});

describe('POST /assessment/grade', () => {
  const question = { question: 'She ___ (visit) Samarkand.', accepted_answers: ['has visited'] };

  it('requires auth', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/assessment/grade').send({ ...question, answer: 'has visited' });
    expect(res.status).toBe(401);
  });

  it('grades a matching answer correct and a wrong one incorrect', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;

    const ok = await request(app)
      .post('/assessment/grade')
      .set('Authorization', `Bearer ${session}`)
      .send({ ...question, answer: 'has visited' });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ correct: true });

    const no = await request(app)
      .post('/assessment/grade')
      .set('Authorization', `Bearer ${session}`)
      .send({ ...question, answer: 'have went' });
    expect(no.body).toMatchObject({ correct: false });
  });

  it('rejects a malformed body', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;
    const res = await request(app)
      .post('/assessment/grade')
      .set('Authorization', `Bearer ${session}`)
      .send({ question: 'x', answer: 'y' }); // no accepted_answers
    expect(res.status).toBe(400);
  });
});

describe('level check (§8.11)', () => {
  it('requires auth for the bank', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/level-check');
    expect(res.status).toBe(401);
  });

  it('returns the bank, an empty seen set, and no placement for a fresh student', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;
    const res = await request(app).get('/level-check').set('Authorization', `Bearer ${session}`);
    expect(res.status).toBe(200);
    expect(res.body.questions).toHaveLength(2);
    expect(res.body.questions[0]).toMatchObject({ id: 'present_simple_be', level: 'A1' });
    expect(res.body.seen).toEqual([]);
    expect(res.body.placement).toBeNull();
  });

  it('records a shown question and reflects it on the next fetch', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;

    const seen = await request(app)
      .post('/level-check/seen')
      .set('Authorization', `Bearer ${session}`)
      .send({ question_id: 'present_simple_be' });
    expect(seen.status).toBe(200);

    const res = await request(app).get('/level-check').set('Authorization', `Bearer ${session}`);
    expect(res.body.seen).toEqual(['present_simple_be']);
  });

  it('rejects a seen call without a question_id', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;
    const res = await request(app)
      .post('/level-check/seen')
      .set('Authorization', `Bearer ${session}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('persists a placement and returns it on the next fetch', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;

    const put = await request(app)
      .put('/level-check/placement')
      .set('Authorization', `Bearer ${session}`)
      .send({ level: 'B1' });
    expect(put.status).toBe(200);
    expect(put.body).toMatchObject({ placement: 'B1' });

    const res = await request(app).get('/level-check').set('Authorization', `Bearer ${session}`);
    expect(res.body.placement).toBe('B1');
  });

  it('rejects an invalid placement level', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;
    const res = await request(app)
      .put('/level-check/placement')
      .set('Authorization', `Bearer ${session}`)
      .send({ level: 'C2' });
    expect(res.status).toBe(400);
  });
});

describe('study plan (§8.12)', () => {
  const A1_PLAN = ['present_simple_be', 'present_simple', 'articles_a_an'];
  const FULL_PLAN = [...A1_PLAN, 'past_simple', 'comparative_adjectives', 'superlative_adjectives'];

  async function place(app: ReturnType<typeof buildApp>['app'], session: string, level: string) {
    return request(app)
      .put('/level-check/placement')
      .set('Authorization', `Bearer ${session}`)
      .send({ level });
  }
  async function pass(app: ReturnType<typeof buildApp>['app'], session: string, topicId: string) {
    return request(app)
      .put(`/progress/${topicId}`)
      .set('Authorization', `Bearer ${session}`)
      .send({ status: 'passed' });
  }
  async function advance(app: ReturnType<typeof buildApp>['app'], session: string, topicId: string) {
    return request(app)
      .post('/study-plan/advance')
      .set('Authorization', `Bearer ${session}`)
      .send({ topic_id: topicId });
  }
  const getPlan = (app: ReturnType<typeof buildApp>['app'], session: string) =>
    request(app).get('/study-plan').set('Authorization', `Bearer ${session}`);

  it('requires auth', async () => {
    const { app } = buildApp();
    expect((await request(app).get('/study-plan')).status).toBe(401);
  });

  it('is null before placement, then built (family-grouped + pinned) on placement', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;

    expect((await getPlan(app, session)).body.plan).toBeNull();

    await place(app, session, 'A1');
    const res = await getPlan(app, session);
    expect(res.body.plan.level).toBe('A1');
    // families grouped by authored order; comparative before superlative (pin).
    expect(res.body.plan.ordered_topic_ids).toEqual(FULL_PLAN);
    expect(res.body.plan.current_topic_id).toBe('present_simple_be');
    expect(res.body.plan.stats).toEqual({ level: 'A1', completed: 0, total: 3 });
  });

  it('advances only on clearing the current topic, and reports the level stat', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;
    await place(app, session, 'A1');

    await pass(app, session, 'present_simple_be');
    const res = await advance(app, session, 'present_simple_be');
    expect(res.body.plan.current_topic_id).toBe('present_simple');
    expect(res.body.plan.current_position).toBe(1);
    expect(res.body.plan.stats.completed).toBe(1);
  });

  it('silently skips a detour-passed topic when the path reaches it (§8.12)', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;
    await place(app, session, 'A1');

    // Detour: clear articles_a_an (3rd in path) out of sequence — path stays put.
    await pass(app, session, 'articles_a_an');
    expect((await getPlan(app, session)).body.plan.current_topic_id).toBe('present_simple_be');

    // Walk the path: clearing #1 then #2 should jump over the already-passed #3.
    await pass(app, session, 'present_simple_be');
    await advance(app, session, 'present_simple_be');
    await pass(app, session, 'present_simple');
    const res = await advance(app, session, 'present_simple');
    expect(res.body.plan.current_topic_id).toBe('past_simple'); // articles_a_an skipped
  });

  it('rebuilds fresh on a retake at a different level, keeps it on the same level', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;
    await place(app, session, 'A1');
    await pass(app, session, 'present_simple_be');
    await advance(app, session, 'present_simple_be');

    // Same-level retake: plan + position preserved.
    await place(app, session, 'A1');
    expect((await getPlan(app, session)).body.plan.current_position).toBe(1);

    // Different-level retake: brand-new plan at the new level, position reset.
    await place(app, session, 'A2');
    const res = await getPlan(app, session);
    expect(res.body.plan.level).toBe('A2');
    expect(res.body.plan.ordered_topic_ids).toEqual([
      'past_simple',
      'comparative_adjectives',
      'superlative_adjectives',
    ]);
    expect(res.body.plan.current_position).toBe(0);
  });

  it('advance requires a topic_id', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;
    await place(app, session, 'A1');
    const res = await request(app)
      .post('/study-plan/advance')
      .set('Authorization', `Bearer ${session}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('greeting variant (§8.12)', () => {
  it('is full the first time, short on a repeat the same day', async () => {
    const { app } = buildApp();
    const session = (await signIn(app)).body.session as string;

    const first = await request(app).post('/me/greeting').set('Authorization', `Bearer ${session}`);
    expect(first.body).toEqual({ variant: 'full' });

    const second = await request(app).post('/me/greeting').set('Authorization', `Bearer ${session}`);
    expect(second.body).toEqual({ variant: 'short' });
  });

  it('requires auth', async () => {
    const { app } = buildApp();
    expect((await request(app).post('/me/greeting')).status).toBe(401);
  });
});

describe('sign-out preserves saved progress (§8.9)', () => {
  it('does not delete the user or their progress', async () => {
    const { app, users, progress } = buildApp();
    const session = (await signIn(app)).body.session as string;

    await request(app)
      .put('/progress/past_simple_tense')
      .set('Authorization', `Bearer ${session}`)
      .send({ status: 'passed', quiz_score: 90, mastered: true });

    const signout = await request(app)
      .post('/auth/signout')
      .set('Authorization', `Bearer ${session}`);
    expect(signout.status).toBe(200);

    // The whole point: signing out leaves identity + progress intact.
    expect(users.store.get('42')).toBeDefined();
    expect(progress.store.get('42:past_simple_tense')).toMatchObject({
      status: 'passed',
      quiz_score: 90,
      mastered: true,
    });
  });
});
