import { describe, expect, it } from 'vitest';
import { parseTopic, TOPIC_LEVELS } from '../src/modules/content/topic';
import { parseDoodle } from '../src/modules/content/doodle';

const validTopic = {
  topic_id: 'present_perfect_tense',
  level: 'B1',
  formula: 'have / has + past participle',
  key_idea: 'Connects the past to now.',
  examples: ['I have visited Samarkand.'],
  common_mistakes: ["Saying 'I have went'."],
};

const validDoodle = {
  id: 'person_a',
  name: 'Person A',
  category: 'people',
  description: 'Generic standing figure.',
  asset_status: 'complete',
};

describe('parseTopic', () => {
  it('accepts and normalizes a valid topic', () => {
    expect(parseTopic(validTopic, 0)).toEqual(validTopic);
  });

  it('accepts every documented CEFR level, including B1+', () => {
    for (const level of TOPIC_LEVELS) {
      expect(parseTopic({ ...validTopic, level }, 0).level).toBe(level);
    }
  });

  it('rejects an unknown level', () => {
    expect(() => parseTopic({ ...validTopic, level: 'C2' }, 3)).toThrow(/topics\[3\].*level/);
  });

  it('rejects a missing required field', () => {
    const { formula, ...noFormula } = validTopic;
    expect(() => parseTopic(noFormula, 5)).toThrow(/formula/);
  });

  it('rejects examples that are not an array of strings', () => {
    expect(() => parseTopic({ ...validTopic, examples: 'nope' }, 0)).toThrow(/examples/);
    expect(() => parseTopic({ ...validTopic, common_mistakes: [1, 2] }, 0)).toThrow(
      /common_mistakes/,
    );
  });

  it('rejects a non-object', () => {
    expect(() => parseTopic(null, 0)).toThrow(/must be an object/);
  });
});

describe('parseDoodle', () => {
  it('accepts a valid doodle', () => {
    expect(parseDoodle(validDoodle, 0)).toEqual(validDoodle);
  });

  it('defaults asset_status to complete when absent', () => {
    const { asset_status, ...noStatus } = validDoodle;
    expect(parseDoodle(noStatus, 0).asset_status).toBe('complete');
  });

  it('rejects a missing id', () => {
    const { id, ...noId } = validDoodle;
    expect(() => parseDoodle(noId, 2)).toThrow(/doodle-library\[2\].*id/);
  });
});
