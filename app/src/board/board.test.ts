import { describe, expect, it } from 'vitest';
import { parseBoardScript } from './validate';
import { beatDurationMs } from './pacing';
import { buildScene } from './sceneModel';
import { presentPerfectSample } from './samples/present-perfect';
import type { DoodleCatalog } from './doodleCatalog';

const catalog: DoodleCatalog = new Map(
  [
    ['person_a', 'people'],
    ['person_b', 'people'],
    ['suitcase', 'objects'],
    ['face_happy', 'expressions'],
    ['speech_bubble', 'communication'],
  ].map(([id, category]) => [id, { id, category, description: '', url: `https://x/${id}.svg` }]),
);
const ids = new Set(catalog.keys());

describe('parseBoardScript', () => {
  it('accepts the §8.2 sample against the catalog', () => {
    const script = parseBoardScript(presentPerfectSample, ids);
    expect(script.topic_id).toBe('present_perfect');
    expect(script.beats).toHaveLength(12);
  });

  it('rejects a doodle whose element_id is not in the catalog', () => {
    const bad = {
      topic_id: 't',
      level: 'A1',
      beats: [{ id: 1, type: 'story_beat', narration: 'x', doodles: [{ element_id: 'dragon', position: 'left' }] }],
    };
    expect(() => parseBoardScript(bad, ids)).toThrow(/dragon/);
  });

  it('rejects an unknown formal style', () => {
    const bad = {
      topic_id: 't',
      level: 'A1',
      beats: [{ id: 1, type: 'formal_beat', style: 'banner', content: 'x' }],
    };
    expect(() => parseBoardScript(bad, ids)).toThrow(/unknown formal style/);
  });

  it('rejects a check-in whose correct_index is out of range', () => {
    const bad = {
      topic_id: 't',
      level: 'A1',
      beats: [
        { id: 1, type: 'formal_beat', style: 'check_in_question', question: 'q', options: ['a', 'b'], correct_index: 5 },
      ],
    };
    expect(() => parseBoardScript(bad, ids)).toThrow(/correct_index/);
  });

  it('rejects an unknown beat type', () => {
    const bad = { topic_id: 't', level: 'A1', beats: [{ id: 1, type: 'video_beat' }] };
    expect(() => parseBoardScript(bad, ids)).toThrow(/unknown beat type/);
  });
});

describe('quiz validation (§8.4)', () => {
  it('accepts the sample quiz and exposes it on the script', () => {
    const script = parseBoardScript(presentPerfectSample, ids);
    expect(script.quiz).toHaveLength(10);
  });

  it('rejects a quiz outside the 10–15 range', () => {
    const bad = { ...presentPerfectSample, quiz: presentPerfectSample.quiz!.slice(0, 4) };
    expect(() => parseBoardScript(bad, ids)).toThrow(/10.*15|questions/);
  });

  it('rejects a question tagging a non-existent beat', () => {
    const quiz = presentPerfectSample.quiz!.map((q, i) => (i === 0 ? { ...q, tests_beat_id: 99 } : q));
    expect(() => parseBoardScript({ ...presentPerfectSample, quiz }, ids)).toThrow(/tests_beat_id/);
  });

  it('rejects a fill-in-the-blank question with no accepted_answers', () => {
    const quiz = presentPerfectSample.quiz!.map((q, i) =>
      i === 0 ? { quiz_question_id: 1, type: 'fill_in_the_blank', question: 'x?', tests_beat_id: 9 } : q,
    );
    expect(() => parseBoardScript({ ...presentPerfectSample, quiz }, ids)).toThrow(/accepted_answers/);
  });
});

describe('beatDurationMs', () => {
  it('stays within bounds and grows with text length', () => {
    const short = beatDurationMs({ id: 1, type: 'formal_beat', style: 'title', content: 'Hi' });
    const long = beatDurationMs({ id: 2, type: 'story_beat', narration: 'x'.repeat(200), doodles: [] });
    expect(short).toBeGreaterThanOrEqual(1800);
    expect(long).toBeLessThanOrEqual(9000);
    expect(long).toBeGreaterThan(short);
  });
});

describe('buildScene', () => {
  it('anchors people and attaches faces/objects/bubbles, newest bubble winning', () => {
    const script = parseBoardScript(presentPerfectSample, ids);
    const scene = buildScene(script.beats.slice(0, 5), catalog); // the story run: beats 2–5

    const left = scene.columns.find((c) => c.position === 'left')!;
    const right = scene.columns.find((c) => c.position === 'right')!;

    expect(left.personId).toBe('person_a');
    expect(left.faceId).toBe('face_happy');
    expect(left.objects.map((o) => o.element_id)).toContain('suitcase');
    expect(left.bubble?.text).toContain('Samarkand');
    // Marcus gets a bubble in beat 3 and another in beat 5 — the later one wins.
    expect(right.bubble?.text).toContain('Bukhara');
  });
});
