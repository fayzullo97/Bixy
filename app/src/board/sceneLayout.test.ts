import { describe, expect, it } from 'vitest';
import { buildScene } from './sceneModel';
import type { Beat, DoodleRef } from './types';
import type { DoodleCatalog } from './doodleCatalog';

const catalog: DoodleCatalog = new Map([
  ['person_a', { id: 'person_a', category: 'people', description: '', url: '/p.svg' }],
  ['person_b', { id: 'person_b', category: 'people', description: '', url: '/pb.svg' }],
  ['face_happy', { id: 'face_happy', category: 'expressions', description: '', url: '/f.svg' }],
  ['suitcase', { id: 'suitcase', category: 'objects', description: '', url: '/s.svg' }],
  ['phone', { id: 'phone', category: 'objects', description: '', url: '/ph.svg' }],
  ['book', { id: 'book', category: 'objects', description: '', url: '/b.svg' }],
  ['speech_bubble', { id: 'speech_bubble', category: 'bubbles', description: '', url: '/sb.svg' }],
]);

const story = (id: number, doodles: DoodleRef[]): Beat => ({
  id,
  type: 'story_beat',
  narration: `beat ${id}`,
  doodles,
});

describe('scene layout (Part 03 §4)', () => {
  it('collects multiple objects on one person, which the renderer must fan out', () => {
    // Regression guard for the overlap found by code trace: several props on one
    // character all landed on the same fixed offset and drew on top of each other.
    // The model legitimately produces this shape, so the fix belongs in layout.
    const scene = buildScene(
      [
        story(1, [{ element_id: 'person_a', position: 'left' }]),
        story(2, [{ element_id: 'suitcase', attached_to: 'person_a' }]),
        story(3, [{ element_id: 'phone', attached_to: 'person_a' }]),
        story(4, [{ element_id: 'book', attached_to: 'person_a' }]),
      ],
      catalog,
    );
    const left = scene.columns.find((c) => c.position === 'left')!;
    expect(left.objects.map((o) => o.element_id)).toEqual(['suitcase', 'phone', 'book']);
  });

  it('keeps consecutive beats as ONE evolving scene, not per-beat panels', () => {
    // Confirmed design (Part 03 §4): a character gains a face and then a bubble
    // in place — dialogue advances rather than each beat getting its own panel.
    const scene = buildScene(
      [
        story(1, [{ element_id: 'person_a', position: 'left' }]),
        story(2, [{ element_id: 'face_happy', attached_to: 'person_a' }]),
        story(3, [{ element_id: 'speech_bubble', attached_to: 'person_a', text: 'Hi!' }]),
      ],
      catalog,
    );
    expect(scene.columns).toHaveLength(1);
    const left = scene.columns[0]!;
    expect(left.personId).toBe('person_a');
    expect(left.faceId).toBe('face_happy');
    expect(left.bubble?.text).toBe('Hi!');
  });

  it('a later bubble on the same person replaces the earlier one', () => {
    const scene = buildScene(
      [
        story(1, [{ element_id: 'person_a', position: 'left' }]),
        story(2, [{ element_id: 'speech_bubble', attached_to: 'person_a', text: 'First' }]),
        story(3, [{ element_id: 'speech_bubble', attached_to: 'person_a', text: 'Second' }]),
      ],
      catalog,
    );
    expect(scene.columns[0]!.bubble?.text).toBe('Second');
  });

  it('keeps people in distinct columns rather than merging them', () => {
    const scene = buildScene(
      [
        story(1, [
          { element_id: 'person_a', position: 'left' },
          { element_id: 'person_b', position: 'right' },
        ]),
        story(2, [{ element_id: 'suitcase', attached_to: 'person_b' }]),
      ],
      catalog,
    );
    expect(scene.columns.map((c) => c.position)).toEqual(['left', 'right']);
    expect(scene.columns.find((c) => c.position === 'right')!.objects).toHaveLength(1);
    expect(scene.columns.find((c) => c.position === 'left')!.objects).toHaveLength(0);
  });

  it('falls back to `loose` for a doodle anchored to nobody', () => {
    const scene = buildScene([story(1, [{ element_id: 'suitcase', attached_to: 'nobody' }])], catalog);
    expect(scene.loose.map((d) => d.element_id)).toEqual(['suitcase']);
  });
});
