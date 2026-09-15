import { describe, expect, it } from 'vitest';
import { contentLanguage } from '../src/modules/generation/contentLanguage';
import { parseBoardScript } from '../src/modules/generation/boardScript';
import { scriptLanguageIssue } from '../src/modules/generation/languageCheck';
import type { BoardScript } from '../src/modules/generation/boardScript';

describe('contentLanguage — the level gate (Part 01 §1)', () => {
  it('keeps the student’s language for A1–B2', () => {
    for (const level of ['A1', 'A2', 'B1', 'B1+', 'B2']) {
      expect(contentLanguage(level, 'ru')).toBe('ru');
      expect(contentLanguage(level, 'uz')).toBe('uz');
    }
  });

  it('forces English at C1 whatever the student selected', () => {
    expect(contentLanguage('C1', 'ru')).toBe('en');
    expect(contentLanguage('C1', 'uz')).toBe('en');
    expect(contentLanguage('C1', 'en')).toBe('en');
  });

  it('is case- and whitespace-insensitive about the tier', () => {
    expect(contentLanguage(' c1 ', 'ru')).toBe('en');
  });
});

/** A minimal ru lesson: English-locked fields English, localized fields Russian. */
function ruScript(overrides: Partial<Record<string, unknown>> = {}): BoardScript {
  return {
    topic_id: 'present_perfect',
    level: 'A2',
    beats: [
      { id: 1, type: 'formal_beat', style: 'title', term: 'Present Perfect' },
      {
        id: 2,
        type: 'story_beat',
        narration: 'Это предложение на русском языке для повествования урока.',
        doodles: [{ element_id: 'person_a', position: 'left', text: 'I have been there.' }],
      },
      {
        id: 3,
        type: 'formal_beat',
        style: 'common_mistake',
        wrong: 'I have visit Samarkand.',
        correct: 'I have visited Samarkand.',
        note: 'После have глагол принимает форму причастия прошедшего времени.',
        ...overrides,
      },
    ],
  } as BoardScript;
}

describe('languageCheck — per-field buckets (Part 01 §1)', () => {
  it('accepts a ru lesson with English-locked fields in English', () => {
    expect(scriptLanguageIssue(ruScript(), 'ru')).toBeNull();
  });

  it('flags an English-locked field that got translated, at any level', () => {
    const bad = ruScript({
      wrong: 'Я имею посетить Самарканд.',
      correct: 'Я посетил Самарканд полностью и целиком.',
    });
    expect(scriptLanguageIssue(bad, 'ru')).toMatch(/`beats\[2\]\.wrong` must be in English/);
  });

  it('flags a `note` left in English when the student’s language is Russian', () => {
    const bad = ruScript({
      note: 'After have, the verb takes its past participle form, never the plain one.',
    });
    // Caught even though the narration and bubble around it are correctly
    // Russian — an aggregate majority check would let this one field hide.
    expect(scriptLanguageIssue(bad, 'ru')).toMatch(/`beats\[2\]\.note` must be written in Russian/);
  });

  it('keeps bubble dialogue English-locked — it is the demonstrated sentence', () => {
    // The story track teaches by having characters SPEAK the target grammar, so a
    // bubble is the English sentence being taught. Verified live: generating
    // `present_simple_be` in ru produced bubbles "I am an engineer" / "It is
    // cold" — translating those would demonstrate nothing about English "to be".
    const script = ruScript();
    const story = script.beats[1] as { doodles: Array<{ text?: string }> };
    story.doodles[0]!.text = 'I am an engineer, and she is a nurse.';
    expect(scriptLanguageIssue(script, 'ru')).toBeNull();
  });

  it('flags a bubble that got translated', () => {
    const script = ruScript();
    const story = script.beats[1] as { doodles: Array<{ text?: string }> };
    story.doodles[0]!.text = 'Я инженер, а она медсестра.';
    expect(scriptLanguageIssue(script, 'ru')).toMatch(/`beats\[1\]\.doodles\[0\]\.text` must be in English/);
  });

  it('treats a C1 lesson as fully English — Russian narration is a miss', () => {
    // The gate resolves C1 to 'en' before this runs, so Cyrillic narration fails.
    expect(scriptLanguageIssue(ruScript(), contentLanguage('C1', 'ru'))).toMatch(/must be written in English/);
  });
});

describe('board script parser — per-style required fields', () => {
  const base = { topic_id: 't', level: 'A2' };
  const parse = (beat: unknown) => () => parseBoardScript({ ...base, beats: [beat] });

  it('accepts each style in its own shape', () => {
    const script = parseBoardScript({
      ...base,
      beats: [
        { id: 1, type: 'formal_beat', style: 'title', term: 'Present Perfect' },
        { id: 2, type: 'formal_beat', style: 'formula', formula: 'have + V3', note: 'Порядок слов.' },
        { id: 3, type: 'formal_beat', style: 'explanation', note: 'Это связывает прошлое с настоящим.' },
        { id: 4, type: 'formal_beat', style: 'example', sentence: 'I have visited Samarkand.' },
        { id: 5, type: 'formal_beat', style: 'recap_example', sentence: 'I have been there.', emphasis: 'have' },
        { id: 6, type: 'formal_beat', style: 'common_mistake', wrong: 'I have visit.', correct: 'I have visited.', note: 'Причастие.' },
      ],
    });
    expect(script.beats).toHaveLength(6);
    expect(script.beats[5]).toMatchObject({ wrong: 'I have visit.', correct: 'I have visited.' });
  });

  it('rejects a common_mistake missing its correction — the pair is required', () => {
    expect(parse({ id: 1, type: 'formal_beat', style: 'common_mistake', wrong: 'I have visit.', note: 'x' })).toThrow(/`correct`/);
  });

  it('rejects an explanation with no note', () => {
    expect(parse({ id: 1, type: 'formal_beat', style: 'explanation' })).toThrow(/`note`/);
  });

  it('rejects the retired v1 shape outright, rather than half-parsing it', () => {
    expect(parse({ id: 1, type: 'formal_beat', style: 'title', content: 'Present Perfect' })).toThrow(/`term`/);
  });

  it('drops fields a style does not carry instead of smuggling them through', () => {
    const script = parseBoardScript({
      ...base,
      beats: [{ id: 1, type: 'formal_beat', style: 'title', term: 'Present Perfect', note: 'должен быть отброшен' }],
    });
    expect(script.beats[0]).not.toHaveProperty('note');
  });
});
