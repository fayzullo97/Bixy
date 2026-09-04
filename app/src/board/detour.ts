import type { AskResult } from '../api/client';
import type { Beat, BoardScript } from './types';

/** What the board should do with a resolved input (§8.5/§8.12). */
export type AskDecision =
  | { action: 'detour'; topicId: string; boardScript: BoardScript }
  | { action: 'replay'; boardScript: BoardScript }
  | { action: 'reexplain'; beats: Beat[] }
  | { action: 'off_topic' };

/**
 * Maps an ask result to a board action, given the topic the student is currently
 * on. A lesson for a *different* topic is a detour (§8.12) — played now, returning
 * to the plan topic after; the *same* topic is a replay from the top; a
 * re-explanation appends to the current board; no_content is surfaced plainly.
 */
export function decideAsk(result: AskResult, activeTopicId: string | null): AskDecision {
  if (result.kind === 'reexplain') return { action: 'reexplain', beats: result.beats };
  if (result.kind === 'no_content') return { action: 'off_topic' };
  if (result.topic_id === activeTopicId) return { action: 'replay', boardScript: result.board_script };
  return { action: 'detour', topicId: result.topic_id, boardScript: result.board_script };
}
