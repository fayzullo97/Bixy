import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { FONT_REGULAR, FONT_SEMIBOLD } from './fonts';
import {
  MEETING_FIELDS,
  answerQuestion,
  currentField,
  initialMeeting,
  skipMeeting,
  skipQuestion,
  type MeetingAnswers,
  type MeetingState,
} from './meeting';
import type { strings } from '../i18n';

const ACCENT = '#5aa9ff';

/**
 * The one-time first meeting (Part 05 §7): a handful of get-to-know-you
 * questions, one at a time.
 *
 * It opens on the first question rather than on an introduction — Bixy already
 * introduced itself at the greeting (Part 07 §12 step 2), before the level
 * check. `meetOffer` leads the first question so the conversation still says why
 * it's asking; the whole-conversation skip that used to sit on the introduction
 * is on every question already.
 *
 * Styled as the board's own prompt card rather than a form — this is the tutor
 * talking. Every step offers an out, and taking one still ends the meeting: a
 * student who wanted to skip it shouldn't be asked again on their next visit.
 */
export function FirstMeeting({
  t,
  onDone,
}: {
  t: (typeof strings)[keyof typeof strings];
  /** Called once with whatever was answered — possibly nothing. */
  onDone: (answers: MeetingAnswers) => void;
}) {
  const [state, setState] = useState(initialMeeting);
  const [draft, setDraft] = useState('');
  // Ending the meeting hands off to an async write, so this component stays
  // mounted on the last question until the parent switches phase. The buttons
  // are still live in that gap — a second tap would send a second profile write
  // and a second greeting call. `onDone` is a one-shot.
  const finished = useRef(false);

  const step = useCallback(
    (next: MeetingState) => {
      setDraft('');
      if (next.step !== 'done') {
        setState(next);
        return;
      }
      if (finished.current) return;
      finished.current = true;
      onDone(next.answers);
    },
    [onDone],
  );

  const field = currentField(state);
  if (!field) return null;
  const isLast = state.index === MEETING_FIELDS.length - 1;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        {state.index === 0 ? <Text style={styles.offer}>{t.meetOffer}</Text> : null}
        <Text style={styles.question}>{t.meetQuestions[field]}</Text>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t.meetPlaceholder}
          placeholderTextColor="#5b6472"
          onSubmitEditing={() => step(answerQuestion(state, draft))}
          returnKeyType={isLast ? 'done' : 'next'}
          autoFocus
        />
        <View style={styles.options}>
          <Pressable
            style={[styles.option, styles.optionPrimary]}
            onPress={() => step(answerQuestion(state, draft))}
            accessibilityRole="button"
          >
            <Text style={styles.optionPrimaryText}>{isLast ? t.meetDone : t.meetNext}</Text>
          </Pressable>
          <Pressable style={styles.option} onPress={() => step(skipQuestion(state))} accessibilityRole="button">
            <Text style={styles.optionText}>{t.meetSkip}</Text>
          </Pressable>
          <Pressable style={styles.linkButton} onPress={() => step(skipMeeting(state))} accessibilityRole="button">
            <Text style={styles.linkText}>{t.meetSkipAll}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#12151c', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: { alignSelf: 'stretch', maxWidth: 640, marginHorizontal: 'auto' },
  offer: { fontFamily: FONT_SEMIBOLD, fontSize: 20, color: '#98a2b3', lineHeight: 28, marginBottom: 22 },
  question: { fontFamily: FONT_SEMIBOLD, fontSize: 28, color: '#ffffff', lineHeight: 36, marginBottom: 18 },
  input: {
    fontFamily: FONT_REGULAR,
    fontSize: 20,
    color: '#e6e8ee',
    borderWidth: 1,
    borderColor: '#3a4256',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 18,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  option: { borderWidth: 1, borderColor: '#3a4256', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 22 },
  optionPrimary: { backgroundColor: ACCENT, borderColor: ACCENT },
  optionPrimaryText: { fontFamily: FONT_SEMIBOLD, fontSize: 20, color: '#0b0e14' },
  optionText: { fontFamily: FONT_REGULAR, fontSize: 20, color: '#e6e8ee' },
  linkButton: { paddingVertical: 6 },
  linkText: { fontFamily: FONT_REGULAR, fontSize: 15, color: '#5b6472', textDecorationLine: 'underline' },
});
