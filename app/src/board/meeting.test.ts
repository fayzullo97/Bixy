import { describe, expect, it } from 'vitest';
import {
  MEETING_FIELDS,
  answerQuestion,
  beginQuestions,
  currentField,
  initialMeeting,
  skipMeeting,
  skipQuestion,
} from './meeting';

const questions = beginQuestions(initialMeeting);

describe('first meeting (Part 05 §7)', () => {
  it('opens with Bixy introducing itself, before any question', () => {
    expect(initialMeeting.step).toBe('intro');
    expect(currentField(initialMeeting)).toBeNull();
    expect(currentField(questions)).toBe(MEETING_FIELDS[0]);
  });

  it('collects an answer and moves on', () => {
    const next = answerQuestion(questions, '  nurse ');
    expect(next.answers).toEqual({ occupation: 'nurse' });
    expect(currentField(next)).toBe(MEETING_FIELDS[1]);
  });

  it('treats a blank answer as a skip rather than storing an empty one', () => {
    const next = answerQuestion(questions, '   ');
    expect(next.answers).toEqual({});
    expect(currentField(next)).toBe(MEETING_FIELDS[1]);
  });

  it('skips one question without losing the others', () => {
    const answered = answerQuestion(questions, 'nurse');
    const skipped = skipQuestion(answered);
    expect(skipped.answers).toEqual({ occupation: 'nurse' });
    expect(currentField(skipped)).toBe(MEETING_FIELDS[2]);
  });

  it('ends after the last question', () => {
    let state = questions;
    for (const _ of MEETING_FIELDS) state = skipQuestion(state);
    expect(state.step).toBe('done');
    expect(currentField(state)).toBeNull();
  });

  it('keeps what was already said when the rest is skipped', () => {
    const answered = answerQuestion(questions, 'nurse');
    const done = skipMeeting(answered);
    expect(done.step).toBe('done');
    expect(done.answers).toEqual({ occupation: 'nurse' });
  });

  it('can be skipped outright, from the introduction', () => {
    const done = skipMeeting(initialMeeting);
    expect(done.step).toBe('done');
    expect(done.answers).toEqual({});
  });
});
