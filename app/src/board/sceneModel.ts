import type { Beat, DoodlePosition, DoodleRef } from './types';
import type { DoodleCatalog } from './doodleCatalog';

export interface SceneColumn {
  position: DoodlePosition;
  personId?: string;
  faceId?: string;
  bubble?: { id: string; text: string };
  objects: DoodleRef[];
}

export interface SceneModel {
  columns: SceneColumn[];
  /** Positioned doodles with no resolvable person anchor — rendered as a fallback. */
  loose: DoodleRef[];
}

const COLUMN_ORDER: DoodlePosition[] = ['left', 'center', 'right'];

function isBubble(id: string): boolean {
  return id === 'speech_bubble' || id === 'thought_bubble';
}

/**
 * Folds the doodles of every story beat (in order) into a persistent scene:
 * people anchor columns; faces / bubbles / objects attach onto the person they
 * reference. A new bubble on a person replaces the previous one (dialogue
 * advances). Pure and deterministic, so it can be unit-tested without rendering.
 */
export function buildScene(beats: Beat[], catalog: DoodleCatalog): SceneModel {
  const columns = new Map<DoodlePosition, SceneColumn>();
  const personPosition = new Map<string, DoodlePosition>();
  const loose: DoodleRef[] = [];

  const columnAt = (position: DoodlePosition): SceneColumn => {
    let column = columns.get(position);
    if (!column) {
      column = { position, objects: [] };
      columns.set(position, column);
    }
    return column;
  };

  const categoryOf = (id: string): string => catalog.get(id)?.category ?? 'unknown';

  for (const beat of beats) {
    if (beat.type !== 'story_beat') continue;
    for (const doodle of beat.doodles) {
      const category = categoryOf(doodle.element_id);

      if (category === 'people' && doodle.position) {
        columnAt(doodle.position).personId = doodle.element_id;
        personPosition.set(doodle.element_id, doodle.position);
        continue;
      }

      if (doodle.attached_to) {
        const position = personPosition.get(doodle.attached_to);
        if (!position) {
          loose.push(doodle);
          continue;
        }
        const column = columnAt(position);
        if (category === 'expressions') column.faceId = doodle.element_id;
        else if (isBubble(doodle.element_id)) column.bubble = { id: doodle.element_id, text: doodle.text ?? '' };
        else column.objects.push(doodle);
        continue;
      }

      if (doodle.position) {
        columnAt(doodle.position).objects.push(doodle);
        continue;
      }
      loose.push(doodle);
    }
  }

  return {
    columns: COLUMN_ORDER.filter((p) => columns.has(p)).map((p) => columns.get(p)!),
    loose,
  };
}
