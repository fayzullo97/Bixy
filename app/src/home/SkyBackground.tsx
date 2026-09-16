import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { asset, sky } from '../theme';

/**
 * The sky wash behind the home, greeting and level-test screens (Part 07 §9/§12):
 * a cyan-to-white vertical gradient with the design's four cloud shapes drifting
 * across the top third.
 *
 * Web-only for the gradient and clouds, the same accepted debt `DoodleSvg` and
 * `BixyCharacter` already carry — off-web it degrades to the flat top color
 * rather than rendering nothing, so a native build still shows a sky.
 */
export function SkyBackground({ children }: { children: ReactNode }) {
  if (Platform.OS !== 'web') {
    return <View style={[styles.root, { backgroundColor: sky.gradientTop }]}>{children}</View>;
  }

  return (
    <View style={styles.root}>
      <div style={GRADIENT} aria-hidden="true">
        {/* Decorative only: the clouds carry no information, so they stay out of
            the accessibility tree and never intercept a tap. */}
        {CLOUDS.map((cloud, i) => (
          <img
            key={asset.clouds[i]}
            src={asset.clouds[i]}
            alt=""
            aria-hidden="true"
            style={{ position: 'absolute', pointerEvents: 'none', ...cloud }}
          />
        ))}
      </div>
      {children}
    </View>
  );
}

/** Cloud placements, in the proportions the design lays them out at 390×844. */
const CLOUDS: Array<Record<string, string>> = [
  { left: '-27%', top: '8%', width: '71%' },
  { left: '73%', top: '1.5%', width: '48%' },
  { left: '73%', top: '19.5%', width: '30%' },
  { left: '-8%', top: '42%', width: '68%' },
];

const GRADIENT = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  background: `linear-gradient(180deg, ${sky.gradientTop} 0%, ${sky.gradientBottom} 55%)`,
} as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: sky.gradientBottom },
});
