import { StyleSheet, Text, View } from 'react-native';
import type { Beat } from './types';
import type { DoodleCatalog } from './doodleCatalog';
import { buildScene, type SceneColumn } from './sceneModel';
import { DoodleSvg } from './DoodleSvg';
import { FONT_REGULAR } from './fonts';

const PERSON_H = 190;
const FACE_H = 46;
const OBJECT_H = 62;
const BUBBLE_W = 190;

// Props attached to a person sit beside them, starting to their left. A second
// prop on the same person used to land on exactly the same fixed offset as the
// first and render on top of it; each now steps right by OBJECT_STEP so they
// fan out instead. The step is a heuristic — a doodle's width comes from its own
// aspect ratio and isn't known until it loads — so it's deliberately narrower
// than OBJECT_H, letting props sit close (slightly overlapping) rather than
// drifting far from the character they belong to.
const OBJECT_LEFT = -44;
const OBJECT_STEP = 52;

// Fixed left→center→right slots so a doodle's `position` maps to the same third of
// the panel whether or not the other columns are present.
const SLOTS: SceneColumn['position'][] = ['left', 'center', 'right'];

function Bubble({ url, text, animate }: { url: string; text: string; animate: boolean }) {
  const height = text.length > 26 ? 98 : 72;
  return (
    <View style={[styles.bubble, { width: BUBBLE_W, height, marginBottom: 8 }]}>
      <View style={styles.fill}>
        <DoodleSvg url={url} width={BUBBLE_W} height={height} stretch animate={animate} />
      </View>
      <Text style={styles.bubbleText}>{text}</Text>
    </View>
  );
}

/**
 * Renders the accumulated story scene (§8.2): people anchored in columns with
 * faces, bubbles and objects attached. Elements are keyed by identity so that,
 * as later beats add to the scene, existing doodles stay drawn and only the new
 * ones animate in.
 */
export function Scene({
  beats,
  catalog,
  animate,
}: {
  beats: Beat[];
  catalog: DoodleCatalog;
  animate: boolean;
}) {
  const scene = buildScene(beats, catalog);
  const url = (id: string): string | undefined => catalog.get(id)?.url;
  const byPosition = new Map(scene.columns.map((c) => [c.position, c]));
  const hasContent = scene.columns.length > 0;

  // A row of three equal slots that sizes to its own content and bottom-aligns the
  // columns (people share a ground line). No fixed height / absolute bottom anchor,
  // so a tall panel can't overflow upward into the panel above it — panels simply
  // stack downward, each self-contained, separated by a 50px gap (§ board cursor).
  return (
    <View style={[styles.scene, hasContent && styles.sceneSpacing]}>
      {SLOTS.map((position) => {
        const col = byPosition.get(position);
        if (!col) return <View key={`slot-${position}`} style={styles.column} />;
        const personUrl = col.personId ? url(col.personId) : undefined;
        const faceUrl = col.faceId ? url(col.faceId) : undefined;
        return (
          <View key={`col-${position}`} style={styles.column}>
            {col.bubble && url(col.bubble.id) ? (
              <Bubble
                key={`b-${col.position}-${col.bubble.id}-${col.bubble.text}`}
                url={url(col.bubble.id)!}
                text={col.bubble.text}
                animate={animate}
              />
            ) : null}

            <View style={styles.personBox}>
              {personUrl ? (
                <DoodleSvg
                  key={`p-${col.position}-${col.personId}`}
                  url={personUrl}
                  height={PERSON_H}
                  animate={animate}
                />
              ) : null}

              {faceUrl ? (
                <View style={styles.faceOverlay} pointerEvents="none">
                  <DoodleSvg
                    key={`f-${col.position}-${col.faceId}`}
                    url={faceUrl}
                    height={FACE_H}
                    animate={animate}
                  />
                </View>
              ) : null}

              {col.objects.map((obj, i) => {
                const objUrl = url(obj.element_id);
                if (!objUrl) return null;
                return (
                  <View
                    key={`o-${col.position}-${i}-${obj.element_id}`}
                    style={[styles.objectOverlay, { left: OBJECT_LEFT + i * OBJECT_STEP }]}
                  >
                    <DoodleSvg url={objUrl} height={OBJECT_H} animate={animate} />
                  </View>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { flexDirection: 'row', alignItems: 'flex-end', alignSelf: 'stretch' },
  // 50px breathing room below each drawn scene so the next block starts clear of it.
  sceneSpacing: { marginBottom: 50 },
  column: { flex: 1, alignItems: 'center' },
  personBox: { position: 'relative', alignItems: 'center', justifyContent: 'flex-end' },
  faceOverlay: { position: 'absolute', top: 4, left: 0, right: 0, alignItems: 'center' },
  // `left` is set per-object at render time (see OBJECT_LEFT / OBJECT_STEP).
  objectOverlay: { position: 'absolute', bottom: -2 },
  bubble: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bubbleText: {
    fontFamily: FONT_REGULAR,
    fontSize: 17,
    color: '#ffffff',
    textAlign: 'center',
    paddingHorizontal: 22,
    paddingVertical: 10,
  },
});
