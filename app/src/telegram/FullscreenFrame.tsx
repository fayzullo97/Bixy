import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTelegramFullscreen } from './useTelegramFullscreen';

/**
 * Wraps the app in Telegram Desktop fullscreen (Part 08 §15): requests it on
 * launch, holds the content clear of the window chrome once it's confirmed, and
 * offers the manual exit.
 *
 * The padding is applied here rather than inside each screen so there's one
 * place that knows about insets — screens keep laying themselves out against a
 * plain full-bleed box, exactly as they did before fullscreen existed.
 *
 * Outside Telegram (a plain browser, the dev routes) every value is inert: the
 * hook finds no WebApp, so insets are zero and no control renders.
 */
export function FullscreenFrame({ children }: { children: ReactNode }) {
  const { canExit, insets, exit } = useTelegramFullscreen();

  return (
    <View style={styles.root}>
      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
            paddingLeft: insets.left,
            paddingRight: insets.right,
          },
        ]}
      >
        {children}
      </View>

      {canExit ? (
        <Pressable
          // Sits inside the top inset so it can't land under the window chrome
          // it exists to escape.
          style={[styles.exit, { top: insets.top + 8, right: insets.right + 8 }]}
          onPress={exit}
          accessibilityRole="button"
          accessibilityLabel="Exit fullscreen"
        >
          <Text style={styles.exitGlyph}>⤡</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { flex: 1 },
  exit: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(18, 21, 28, 0.55)',
    zIndex: 10,
  },
  exitGlyph: { color: '#ffffff', fontSize: 15, lineHeight: 18 },
});
