import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { QuizQuestion } from './types';
import { FONT_BOLD, FONT_REGULAR, FONT_SEMIBOLD } from './fonts';

const CORRECT_COLOR = '#5fd08a';
const WRONG_COLOR = '#ff6b6b';
const ACCENT = '#5aa9ff';

/** The student's answer to one quiz question, plus whether it was correct. */
export type QuizAnswer =
  | { kind: 'choice'; index: number; correct: boolean }
  | { kind: 'text'; text: string; correct: boolean };

/** The two-option set true/false questions always render with. */
function optionsFor(q: QuizQuestion): string[] {
  return q.options ?? (q.type === 'true_false' ? ['True', 'False'] : []);
}

/**
 * One quiz question on the board (§8.4). Multiple-choice and true/false are tapped
 * and graded client-side against `correct_index`; fill-in-the-blank is typed and
 * graded via `gradeFillIn` (server-backed §8.11 grader, or an offline fallback).
 * Controlled: `answer` undefined means unanswered; once set, feedback is shown.
 */
export function QuizQuestionCard({
  q,
  index,
  total,
  answer,
  onAnswer,
  gradeFillIn,
  label,
}: {
  q: QuizQuestion;
  index: number;
  total: number;
  answer?: QuizAnswer;
  onAnswer: (a: QuizAnswer) => void;
  gradeFillIn: (q: QuizQuestion, text: string) => Promise<boolean>;
  /** Overrides the "Question N of M" counter — used by the level check (§8.11),
   *  where the total is unknown because the test is adaptive. */
  label?: string;
}) {
  const [text, setText] = useState('');
  const [grading, setGrading] = useState(false);
  const answered = answer !== undefined;
  const inputRef = useRef<TextInput | null>(null);

  /**
   * Nudges the focused input above the on-screen keyboard (web only — this
   * board runs on react-native-web even inside Telegram's in-app browser,
   * which has no native `KeyboardAvoidingView` support; a mobile browser only
   * auto-scrolls its OWN document scroller on focus, never a custom `ScrollView`
   * like the board's, so the input stays hidden under the keyboard otherwise).
   * RN Web forwards a host component's ref to its underlying DOM node, which is
   * a real `<input>` and so supports `scrollIntoView` directly; native builds
   * have no such method on `TextInput`, so this is a no-op there and the
   * platform's own keyboard handling applies. Deferred one frame because the
   * keyboard is still animating in the instant `focus` fires — scrolling before
   * then measures against the pre-resize layout.
   */
  const scrollInputIntoView = () => {
    const node = inputRef.current as unknown as { scrollIntoView?: (opts?: ScrollIntoViewOptions) => void };
    setTimeout(() => node.scrollIntoView?.({ behavior: 'smooth', block: 'center' }), 50);
  };

  const submitText = async () => {
    if (grading || !text.trim()) return;
    setGrading(true);
    try {
      const correct = await gradeFillIn(q, text);
      onAnswer({ kind: 'text', text, correct });
    } finally {
      setGrading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.counter}>{label ?? `Question ${index + 1} of ${total}`}</Text>
      <Text style={styles.question}>{q.question}</Text>

      {q.type === 'fill_in_the_blank' ? (
        <View style={styles.fitb}>
          {answered ? (
            <Text
              style={[
                styles.typedAnswer,
                { color: (answer as { correct: boolean }).correct ? CORRECT_COLOR : WRONG_COLOR },
              ]}
            >
              {(answer as { text: string }).text}
            </Text>
          ) : (
            <>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={text}
                onChangeText={setText}
                editable={!grading}
                placeholder="Type your answer"
                placeholderTextColor="#5b6472"
                autoCapitalize="none"
                autoCorrect={false}
                onSubmitEditing={submitText}
                onFocus={scrollInputIntoView}
                returnKeyType="done"
              />
              <Pressable
                style={[styles.submit, (!text.trim() || grading) && styles.submitDisabled]}
                disabled={!text.trim() || grading}
                onPress={submitText}
                accessibilityRole="button"
              >
                {grading ? (
                  <ActivityIndicator color="#0b0e14" />
                ) : (
                  <Text style={styles.submitText}>Check</Text>
                )}
              </Pressable>
            </>
          )}
          {answered && !(answer as { correct: boolean }).correct ? (
            <Text style={styles.acceptedNote}>Answer: {q.accepted_answers?.[0]}</Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.options}>
          {optionsFor(q).map((option, i) => {
            const picked = answered && (answer as { index: number }).index === i;
            const isCorrect = answered && i === q.correct_index;
            const isWrongPick = picked && !isCorrect;
            const borderColor = isCorrect ? CORRECT_COLOR : isWrongPick ? WRONG_COLOR : '#3a4256';
            const color = isCorrect ? CORRECT_COLOR : isWrongPick ? WRONG_COLOR : '#e6e8ee';
            return (
              <Pressable
                key={i}
                disabled={answered}
                onPress={() => onAnswer({ kind: 'choice', index: i, correct: i === q.correct_index })}
                accessibilityRole="button"
                style={[styles.option, { borderColor }, isCorrect && styles.optionCorrectFill]}
              >
                <Text style={[styles.optionText, { color }]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

export type MasteryOutcome = 'passed' | 'reteach_missed' | 'reteach_all';

/** A transitional card on the board: quiz intro, a re-teach lead-in, or the final
 *  graded result. Kept on the same board as the lesson (§8.4/§11), not a popup. */
export function NoteCard({
  title,
  body,
  tone,
}: {
  title: string;
  body?: string;
  tone: 'info' | 'success' | 'warn';
}) {
  const accent = tone === 'success' ? CORRECT_COLOR : tone === 'warn' ? WRONG_COLOR : ACCENT;
  return (
    <View style={[styles.note, { borderLeftColor: accent }]}>
      <Text style={[styles.noteTitle, { color: accent }]}>{title}</Text>
      {body ? <Text style={styles.noteBody}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginVertical: 14, alignSelf: 'stretch' },
  counter: { fontFamily: FONT_REGULAR, fontSize: 15, color: '#5b6472', marginBottom: 8 },
  question: { fontFamily: FONT_SEMIBOLD, fontSize: 27, color: '#ffffff', marginBottom: 14, lineHeight: 34 },
  options: { gap: 10 },
  option: {
    borderWidth: 1,
    borderColor: '#3a4256',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  optionCorrectFill: { backgroundColor: 'rgba(95,208,138,0.12)' },
  optionText: { fontFamily: FONT_REGULAR, fontSize: 24, color: '#e6e8ee' },
  fitb: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  input: {
    fontFamily: FONT_REGULAR,
    fontSize: 24,
    color: '#ffffff',
    borderBottomWidth: 2,
    borderBottomColor: ACCENT,
    paddingVertical: 6,
    minWidth: 220,
  },
  submit: { backgroundColor: ACCENT, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  submitDisabled: { opacity: 0.4 },
  submitText: { fontFamily: FONT_SEMIBOLD, fontSize: 18, color: '#0b0e14' },
  typedAnswer: { fontFamily: FONT_SEMIBOLD, fontSize: 24 },
  acceptedNote: { fontFamily: FONT_REGULAR, fontSize: 18, color: '#98a2b3', width: '100%' },
  note: {
    marginVertical: 16,
    alignSelf: 'stretch',
    borderLeftWidth: 3,
    paddingLeft: 16,
    paddingVertical: 4,
  },
  noteTitle: { fontFamily: FONT_BOLD, fontSize: 26, marginBottom: 6 },
  noteBody: { fontFamily: FONT_REGULAR, fontSize: 20, color: '#c8ccd6', lineHeight: 28 },
});
