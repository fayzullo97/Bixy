import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONT_REGULAR, FONT_SEMIBOLD } from './fonts';

// The board's continue-prompt (§8.12), reused three ways: session start/resume,
// path-to-path after a pass, and returning from a detour. Rendered the same way
// a check-in question is (§8.4) — a question with tappable options on the board —
// not a new UI pattern. Purely a choice (not graded), so it's a lightweight card
// rather than a CheckInBeat.

const ACCENT = '#5aa9ff';

export function BoardPrompt({
  greeting,
  question,
  yesLabel,
  noLabel,
  onYes,
  onNo,
}: {
  /** Optional greeting line above the question (full or "welcome back", §8.12). */
  greeting?: string;
  question: string;
  yesLabel: string;
  noLabel: string;
  onYes: () => void;
  onNo: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        {greeting ? <Text style={styles.greeting}>{greeting}</Text> : null}
        <Text style={styles.question}>{question}</Text>
        <View style={styles.options}>
          <Pressable style={[styles.option, styles.optionYes]} onPress={onYes} accessibilityRole="button">
            <Text style={styles.optionYesText}>{yesLabel}</Text>
          </Pressable>
          <Pressable style={styles.option} onPress={onNo} accessibilityRole="button">
            <Text style={styles.optionText}>{noLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#12151c', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { alignSelf: 'stretch', maxWidth: 640, marginHorizontal: 'auto' },
  greeting: { fontFamily: FONT_SEMIBOLD, fontSize: 22, color: '#98a2b3', marginBottom: 10 },
  question: { fontFamily: FONT_SEMIBOLD, fontSize: 30, color: '#ffffff', marginBottom: 22, lineHeight: 38 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  option: {
    borderWidth: 1,
    borderColor: '#3a4256',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 22,
  },
  optionYes: { backgroundColor: ACCENT, borderColor: ACCENT },
  optionYesText: { fontFamily: FONT_SEMIBOLD, fontSize: 20, color: '#0b0e14' },
  optionText: { fontFamily: FONT_REGULAR, fontSize: 20, color: '#e6e8ee' },
});
