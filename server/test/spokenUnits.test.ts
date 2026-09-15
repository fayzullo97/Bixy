import { describe, expect, it } from 'vitest';
import { spokenUnits } from '../src/modules/generation/spokenUnits';
import { narrationComplete } from '../src/modules/generation/pipeline';
import type { Beat, BoardScript } from '../src/modules/generation/boardScript';

const beat = (b: unknown) => b as Beat;

describe('spokenUnits — what the formal track says aloud (Part 02 §5)', () => {
  it('voices a title', () => {
    expect(spokenUnits(beat({ id: 1, type: 'formal_beat', style: 'title', term: 'Present Perfect' }), 'ru')).toEqual([
      { text: 'Present Perfect', language: 'en' },
    ]);
  });

  it('voices BOTH halves of a common_mistake, then the explanation', () => {
    const units = spokenUnits(
      beat({
        id: 1,
        type: 'formal_beat',
        style: 'common_mistake',
        wrong: 'I have visit Samarkand.',
        correct: 'I have visited Samarkand.',
        note: 'После have нужен причастие.',
      }),
      'ru',
    );
    // The wrong form is spoken too, not just the fix — hearing them next to each
    // other is the point of the pair.
    expect(units).toEqual([
      { text: 'I have visit Samarkand.', language: 'en' },
      { text: 'I have visited Samarkand.', language: 'en' },
      { text: 'После have нужен причастие.', language: 'ru' },
    ]);
  });

  it('tags each unit with its OWN language, so one beat can need two providers', () => {
    const units = spokenUnits(
      beat({ id: 1, type: 'formal_beat', style: 'example', sentence: 'I have visited Samarkand.', note: 'Это связь с настоящим.' }),
      'ru',
    );
    expect(units.map((u) => u.language)).toEqual(['en', 'ru']);
  });

  it('voices a check-in stem but never its options', () => {
    const units = spokenUnits(
      beat({
        id: 1,
        type: 'formal_beat',
        style: 'check_in_question',
        question: 'Which sentence is correct?',
        options: ['I have went.', 'I have gone.'],
        correct_index: 1,
      }),
      'ru',
    );
    expect(units).toEqual([{ text: 'Which sentence is correct?', language: 'en' }]);
  });

  it('never voices `emphasis` — it is a marker inside a sentence already spoken', () => {
    const units = spokenUnits(
      beat({ id: 1, type: 'formal_beat', style: 'recap_example', sentence: 'I have been there.', emphasis: 'have' }),
      'ru',
    );
    expect(units).toEqual([{ text: 'I have been there.', language: 'en' }]);
  });

  it('at C1 every unit is English, since the gate resolved the language first', () => {
    const units = spokenUnits(
      beat({ id: 1, type: 'formal_beat', style: 'explanation', note: 'This emphasises the result.' }),
      'en',
    );
    expect(units).toEqual([{ text: 'This emphasises the result.', language: 'en' }]);
  });

  it('gives an empty-narration story beat nothing to say', () => {
    expect(spokenUnits(beat({ id: 1, type: 'story_beat', narration: '  ', doodles: [] }), 'ru')).toEqual([]);
  });
});

describe('narrationComplete — now covers the whole script', () => {
  const withSpeech = (extra: Partial<BoardScript> = {}): BoardScript =>
    ({
      topic_id: 't',
      level: 'A2',
      beats: [
        {
          id: 1,
          type: 'formal_beat',
          style: 'title',
          term: 'Present Perfect',
          speech: [{ text: 'Present Perfect', language: 'en', audio_url: 'https://cdn/1.wav' }],
        },
        {
          id: 2,
          type: 'story_beat',
          narration: 'Привет.',
          doodles: [],
          speech: [{ text: 'Привет.', language: 'ru', audio_url: 'https://cdn/2.wav' }],
        },
      ],
      ...extra,
    }) as BoardScript;

  it('accepts a script whose every unit has audio', () => {
    expect(narrationComplete(withSpeech())).toBe(true);
  });

  it('rejects a formal beat with no speech at all — the v1-shaped cached row', () => {
    const script = withSpeech();
    delete (script.beats[0] as { speech?: unknown }).speech;
    // This is the self-healing path: such a row fails the gate and regenerates,
    // which is why Part 02 §5 needs no cache-version bump.
    expect(narrationComplete(script)).toBe(false);
  });

  it('rejects a beat whose clip failed to synthesize', () => {
    const script = withSpeech();
    delete (script.beats[1] as { speech: Array<{ audio_url?: string }> }).speech[0]!.audio_url;
    expect(narrationComplete(script)).toBe(false);
  });

  it('requires audio for quiz_intro when the script has one', () => {
    expect(narrationComplete(withSpeech({ quiz_intro: 'Okay, ready?' }))).toBe(false);
    expect(
      narrationComplete(
        withSpeech({
          quiz_intro: 'Okay, ready?',
          quiz_intro_speech: [{ text: 'Okay, ready?', language: 'ru', audio_url: 'https://cdn/q.wav' }],
        }),
      ),
    ).toBe(true);
  });
});
