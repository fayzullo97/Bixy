import { describe, expect, it } from 'vitest';
import { fillerGuidance, WITHHELD_FILLERS } from '../src/modules/generation/fillerWords';
import { buildSystemPrompt, buildUserPrompt } from '../src/modules/generation/systemPrompt';
import type { TopicOutline } from '../src/modules/content/content.repo';

const topic: TopicOutline = {
  topic_id: 'present_perfect_tense',
  level: 'B1',
  formula: 'have / has + past participle',
  key_idea: 'Past connected to now.',
  examples: ['I have visited Samarkand.'],
  common_mistakes: ["'I have went'."],
};

describe('filler words (Part 02 §3)', () => {
  it('ships for Uzbek', () => {
    const guidance = fillerGuidance('uz');
    expect(guidance).toContain('Hmm...');
    expect(guidance).toContain("Xo'p, mayli.");
    expect(guidance).toContain('Voy!');
  });

  it('is absent for ru and en until their banks are drafted', () => {
    // Part 02 §3 ships Uzbek now and tracks ru/en as a follow-up; generation
    // carries no guidance rather than improvising unreviewed interjections.
    expect(fillerGuidance('ru')).toBe('');
    expect(fillerGuidance('en')).toBe('');
  });

  it('never offers the phrases held for native-speaker review', () => {
    const guidance = fillerGuidance('uz');
    for (const phrase of WITHHELD_FILLERS) expect(guidance).not.toContain(phrase);
  });

  it('excludes the praise set, which has no generated field to live in', () => {
    // Praise belongs on a correct check-in answer; the script has no field for
    // one (the board hardcodes "Exactly right."), so offering it would produce
    // text with nowhere to go.
    for (const praise of ['Ajoyib!', "Zo'r!", 'Qoyil!']) {
      expect(fillerGuidance('uz')).not.toContain(praise);
    }
  });

  it('forbids stretched spellings', () => {
    expect(fillerGuidance('uz')).toMatch(/Never stretch a spelling/);
  });

  it('rides in the per-request message, keeping the cached system prompt stable', () => {
    // The system block is sent with cache_control and must stay byte-identical
    // across requests; filler guidance varies by language, so it cannot live there.
    const system = buildSystemPrompt([]);
    expect(system).not.toContain('Hmm...');
    expect(buildUserPrompt(topic, 'uz')).toContain('Hmm...');
    expect(buildUserPrompt(topic, 'ru')).not.toContain('Hmm...');
  });
});
