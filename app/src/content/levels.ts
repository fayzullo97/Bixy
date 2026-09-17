import { LEVELS, type Level } from '../board/levelCheck';

/**
 * Presentation metadata for the six CEFR tiers (Part 07 §9) — the names,
 * one-line descriptions and accent colors the All Levels grid and the level
 * screens render.
 *
 * Names and descriptions are taken from the All Levels card grid in the Figma
 * file (§11), which is the only place in the design where all tiers appear side
 * by side and is therefore self-consistent. The individual "Level A1" frame is
 * NOT used as a source: it carries A2's name and description ("Pre-Intermediate
 * / simple, routine tasks") over an A1 heading, and so does the "Reveal the
 * result" frame. Two frames disagreeing with the grid and with each other is a
 * copy/paste slip in the design, not two intended labels, so the grid wins.
 *
 * `Elementry` in the design is a spelling slip and is corrected here.
 */
export interface LevelMeta {
  level: Level;
  /** The CEFR band's name, e.g. "Intermediate". */
  name: string;
  /** One line of what a student at this tier can do. */
  description: string;
  /** The tier's accent, used for its glyph and progress ring. */
  accent: string;
  /** The wash behind the card's gradient band. */
  tint: string;
}

/** A1/A2 read as blue, the B tiers purple, C1 red — the design's three groups. */
const BLUE = { accent: '#47C2FF', tint: '#E1F9FF' };
const PURPLE = { accent: '#7D52F4', tint: '#ECE1FF' };
const RED = { accent: '#D02533', tint: '#FFE1E1' };

export const LEVEL_META: Record<Level, LevelMeta> = {
  A1: {
    level: 'A1',
    name: 'Elementary',
    description: 'You know basic words and everyday expressions',
    ...BLUE,
  },
  A2: {
    level: 'A2',
    name: 'Pre-Intermediate',
    description: 'You can communicate in simple, routine tasks',
    ...BLUE,
  },
  B1: {
    level: 'B1',
    name: 'Intermediate',
    description: 'You can describe experiences, dreams, and ambitions',
    ...PURPLE,
  },
  'B1+': {
    level: 'B1+',
    name: 'Intermediate+',
    description: 'You can describe experiences, dreams, and ambitions',
    ...PURPLE,
  },
  B2: {
    level: 'B2',
    name: 'Upper-Intermediate',
    description:
      'You can interact with native speakers with a good degree of fluency and spontaneity',
    ...PURPLE,
  },
  C1: {
    level: 'C1',
    name: 'Advanced',
    description: 'You can express yourself fluently without much searching for words',
    ...RED,
  },
};

/**
 * The tiers shown in the app, in order.
 *
 * The design's grid also carries a **C2 / Proficiency** card, and the level-test
 * radar has a C2 spoke. There is no C2 content: `reference-material.json` stops
 * at C1 (Part 0 records "No content past C1 tier yet — flagged, not resolved"),
 * and C1 is already the placement ceiling in §8.11's algorithm. A C2 card would
 * open a level screen with nothing in it, so the tier is left out until content
 * for it exists rather than shipped as a dead end.
 */
export const DISPLAY_LEVELS: readonly Level[] = LEVELS;

export function levelMeta(level: Level): LevelMeta {
  return LEVEL_META[level];
}

/** Narrow a stored placement string to a known tier, or null if it isn't one. */
export function asTopicLevel(value: string | null | undefined): Level | null {
  return LEVELS.includes(value as Level) ? (value as Level) : null;
}
