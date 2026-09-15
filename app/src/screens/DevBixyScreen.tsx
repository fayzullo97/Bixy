import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BixyCharacter } from '../character/BixyCharacter';

/**
 * DEV-ONLY harness for the character (Part 06 §10), mirroring the reference
 * preview's controls so the port can be compared against it side by side:
 * anger as a slider of discrete steps, the addressing toggle that suppresses
 * Look-Around, and a Jump trigger that ignores the hourly throttle.
 */
export function DevBixyScreen({ anger: initialAnger = 0 }: { anger?: number }) {
  const [anger, setAnger] = useState(initialAnger);
  const [addressing, setAddressing] = useState(false);
  const [jumpKey, setJumpKey] = useState(0);

  return (
    <View style={styles.root}>
      <View style={styles.stage}>
        {/* Remounting replays the opening Jump; the throttle still applies, so
            a second press within the hour correctly does nothing. */}
        <BixyCharacter key={jumpKey} height={260} anger={anger} addressing={addressing} jumpOnMount={jumpKey > 0} />
      </View>

      <View style={styles.controls}>
        <Text style={styles.label}>Anger — {Math.round(anger * 100)}%</Text>
        <View style={styles.row}>
          {[0, 0.25, 0.5, 0.75, 1].map((value) => (
            <Pressable
              key={value}
              style={[styles.chip, anger === value && styles.chipActive]}
              onPress={() => setAnger(value)}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, anger === value && styles.chipTextActive]}>
                {Math.round(value * 100)}%
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.row}>
          <Pressable
            style={[styles.chip, addressing && styles.chipActive]}
            onPress={() => setAddressing((v) => !v)}
            accessibilityRole="button"
          >
            <Text style={[styles.chipText, addressing && styles.chipTextActive]}>
              {addressing ? 'Addressing student (gaze held front)' : 'Look-Around running'}
            </Text>
          </Pressable>
          <Pressable style={styles.chip} onPress={() => setJumpKey((k) => k + 1)} accessibilityRole="button">
            <Text style={styles.chipText}>Trigger Jump</Text>
          </Pressable>
        </View>

        <Text style={styles.note}>
          Anger above 0 suppresses Look-Around on its own — an angry Bixy is addressing the student
          continuously (§10's standing rule, one rule with several triggers).
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12151c', gap: 28, padding: 24 },
  stage: { alignItems: 'center', justifyContent: 'center', minHeight: 300 },
  controls: { gap: 12, maxWidth: 560 },
  label: { color: '#98a2b3', fontSize: 14, fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#3a4256', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 14 },
  chipActive: { backgroundColor: '#5aa9ff', borderColor: '#5aa9ff' },
  chipText: { color: '#e6e8ee', fontSize: 14 },
  chipTextActive: { color: '#0b0e14', fontWeight: '600' },
  note: { color: '#5b6472', fontSize: 12, lineHeight: 18 },
});
