import { describe, expect, it } from 'vitest';
import { countScripts, scriptLanguageIssue } from '../src/modules/generation/languageCheck';
import type { BoardScript } from '../src/modules/generation/boardScript';

/** A minimal script with one story beat (narration) + an English title beat. */
function script(narration: string): BoardScript {
  return {
    topic_id: 't',
    level: 'B1',
    beats: [
      { id: 1, type: 'story_beat', narration, doodles: [] },
      { id: 2, type: 'formal_beat', style: 'title', content: 'Present Perfect' },
    ],
  };
}

describe('countScripts', () => {
  it('counts Latin and Cyrillic letters, ignoring punctuation and digits', () => {
    expect(countScripts('abc АБВ 123 — !')).toEqual({ latin: 3, cyrillic: 3 });
  });
});

describe('scriptLanguageIssue', () => {
  it('accepts Russian narration for a ru request', () => {
    expect(scriptLanguageIssue(script('Это русское повествование для этого урока.'), 'ru')).toBeNull();
  });

  it('flags English narration served for a ru request', () => {
    const issue = scriptLanguageIssue(script('This is clearly an English narration sentence.'), 'ru');
    expect(issue).toMatch(/Russian|Cyrillic/);
  });

  it('flags Cyrillic narration served for a uz request', () => {
    const issue = scriptLanguageIssue(script('Это русский текст, а не узбекский вовсе.'), 'uz');
    expect(issue).toMatch(/Uzbek|Cyrillic/);
  });

  it('accepts English narration for an en request', () => {
    expect(scriptLanguageIssue(script('The present perfect connects the past to now.'), 'en')).toBeNull();
  });

  it('does not judge a narration too short to be sure', () => {
    // 'Salom!' is only 5 letters — below the minimum, so no false positive even
    // though it is not Cyrillic for a ru request.
    expect(scriptLanguageIssue(script('Salom!'), 'ru')).toBeNull();
  });

  it('flags board text that slipped into the narration language (§8.7)', () => {
    // Narration too short to judge; the check-in question is in Russian, which is
    // the documented Haiku failure — board text must always be English.
    const withRussianCheckIn: BoardScript = {
      topic_id: 't',
      level: 'B1',
      beats: [
        { id: 1, type: 'story_beat', narration: 'Short.', doodles: [] },
        {
          id: 2,
          type: 'formal_beat',
          style: 'check_in_question',
          question: 'Какой вариант является правильным здесь?',
          options: ['Первый вариант ответа', 'Второй вариант ответа'],
          correct_index: 0,
        },
      ],
    };
    expect(scriptLanguageIssue(withRussianCheckIn, 'ru')).toMatch(/board text|English/i);
  });
});
