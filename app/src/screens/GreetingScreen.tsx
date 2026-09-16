import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BixyCharacter } from '../character/BixyCharacter';
import { SkyBackground } from '../home/SkyBackground';
import { sky, space } from '../theme';

/**
 * The arrival screen (Part 07 §12 step 1): Bixy greets the student, who taps to
 * go on to the level check.
 *
 * **English only, deliberately.** §12: at this point the student's language
 * preference isn't known — the language question comes *after* the level check
 * (step 3) — so there is nothing to localize into and the copy is fixed English.
 * That's why this screen doesn't take a `language` prop at all.
 *
 * Bixy is speaking to the student here, so Look-Around is suppressed and only
 * Float + Breathe run — Part 06's standing rule, expressed by `addressing`.
 */
export function GreetingScreen({ name, onContinue }: { name: string | null; onContinue: () => void }) {
  return (
    <SkyBackground>
      <Pressable
        style={styles.root}
        onPress={onContinue}
        accessibilityRole="button"
        accessibilityLabel="Tap to continue"
      >
        <Text style={styles.hello}>{name ? `Hi, ${name}` : 'Hi there'}</Text>
        <BixyCharacter height={190} addressing jumpOnMount />
        <Text style={styles.hint}>Tap to continue</Text>
      </Pressable>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl },
  hello: { fontSize: 32, fontWeight: '700', color: sky.heading },
  hint: { fontSize: 16, fontWeight: '500', color: sky.hint },
});
