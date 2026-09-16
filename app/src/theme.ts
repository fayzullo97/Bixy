/**
 * Design tokens for the redesigned home flow (Part 07 §9/§12), read out of the
 * Figma file named in §11.
 *
 * The board and the pre-redesign screens are dark (`#12151c`); everything §9
 * covers is the light sky palette below. That isn't drift — §9 supersedes the
 * old home screen outright — but it does mean the two palettes coexist until
 * the board itself is restyled, so they're kept in separate places on purpose.
 */

export const sky = {
  /** Top-to-bottom wash behind the home, greeting and level-test screens. */
  gradientTop: '#82E8FF',
  gradientBottom: '#FFFFFF',
  /** Tap targets and headings over the wash. */
  heading: '#2B303B',
  hint: '#6767A3',
};

export const surface = {
  card: '#FFFFFF',
  cardBorder: '#F5F5F5',
  /** The inset row background inside a card (a locked/coming-soon row). */
  muted: '#F8F8F8',
};

export const text = {
  strong: '#2B303B',
  /** Body copy and subtitles. */
  sub: '#5C5C5C',
  /** Slate variant used for level descriptions in the grid. */
  slate: '#525866',
  /** Disabled row copy. */
  disabled: '#A3A3A3',
  /** Faint labels ("Current topic"). */
  faint: '#C7C7CC',
};

export const status = {
  /** A cleared topic / completed tier. */
  done: '#1DAF61',
  /** An untouched ring. */
  track: '#F7F7F7',
  /** The not-started glyph. */
  pending: '#2B303B',
  pendingBg: '#F5F7FA',
};

/** The five skill rows on a topic-block card (§9), each with its own wash. */
export const skillTint = {
  grammar: '#E7F8FC',
  listening: '#ECE7FC',
  speaking: '#FCF3E7',
  reading: '#FCE9E9',
  writing: '#F8F8F8',
};

export const radius = {
  card: 24,
  tile: 16,
  row: 10,
  pill: 48,
};

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

/** Static asset paths, served from `app/public` at the deployment root. */
export const asset = {
  quote: '/home/quote.svg',
  listening: '/home/listening.svg',
  speaking: '/home/speaking.svg',
  reading: '/home/reading.svg',
  writing: '/home/writing.svg',
  check: '/home/check.svg',
  ringEmpty: '/home/ring-empty.svg',
  chevron: '/home/chevron.svg',
  clouds: ['/home/cloud3.svg', '/home/cloud4.svg', '/home/cloud5.svg', '/home/cloud6.svg'],
};
