import { StyleSheet, Text, View, type DimensionValue } from 'react-native';
import type { Beat } from './types';
import type { DoodleCatalog } from './doodleCatalog';
import { buildScene, type SceneColumn } from './sceneModel';
import { DoodleSvg } from './DoodleSvg';
import { FONT_REGULAR } from './fonts';

const PERSON_H = 190;
const FACE_H = 46;
const OBJECT_H = 62;
const BUBBLE_W = 190;

const COLUMN_X: Record<SceneColumn['position'], DimensionValue> = {
  left: '24%',
  center: '50%',
  right: '76%',
};

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

  return (
    <View style={styles.scene}>
      {scene.columns.map((col) => {
        const personUrl = col.personId ? url(col.personId) : undefined;
        const faceUrl = col.faceId ? url(col.faceId) : undefined;
        return (
          <View
            key={`col-${col.position}`}
            style={[styles.column, { left: COLUMN_X[col.position] }]}
          >
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
                  <View key={`o-${col.position}-${i}-${obj.element_id}`} style={styles.objectOverlay}>
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
  scene: { height: 320, alignSelf: 'stretch', position: 'relative' },
  column: {
    position: 'absolute',
    bottom: 0,
    width: BUBBLE_W,
    transform: [{ translateX: -BUBBLE_W / 2 }],
    alignItems: 'center',
  },
  personBox: { position: 'relative', alignItems: 'center', justifyContent: 'flex-end' },
  faceOverlay: { position: 'absolute', top: 4, left: 0, right: 0, alignItems: 'center' },
  objectOverlay: { position: 'absolute', bottom: -2, left: -44 },
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
