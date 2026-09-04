import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CheckInBeat, ContentFormalBeat, ContentStyle, FormalBeat } from './types';
import { WORD_REVEAL_STAGGER_MS } from './pacing';
import { FONT_BOLD, FONT_REGULAR, FONT_SEMIBOLD } from './fonts';

const CORRECT_COLOR = '#5fd08a';
const WRONG_COLOR = '#ff6b6b';
const ACCENT = '#5aa9ff';

// §8.3 colour + weight per content type. Board is a dark chalkboard, so the
// base "white" text reads as chalk; blue/green/red carry specific meaning.
const STYLE: Record<ContentStyle, { color: string; font: string; fontSize: number }> = {
  title: { color: '#ffffff', font: FONT_BOLD, fontSize: 44 },
  formula: { color: '#5aa9ff', font: FONT_SEMIBOLD, fontSize: 32 },
  explanation: { color: '#ffffff', font: FONT_REGULAR, fontSize: 27 },
  example: { color: '#5fd08a', font: FONT_REGULAR, fontSize: 29 },
  common_mistake: { color: '#ff6b6b', font: FONT_REGULAR, fontSize: 29 },
  recap_example: { color: '#ffffff', font: FONT_REGULAR, fontSize: 29 },
};

const EMPHASIS_COLOR = '#5aa9ff'; // recap emphasis reuses Formula's blue (§8.3)

/** Splits into words while keeping the trailing space so wrapping looks natural. */
function toWords(text: string): string[] {
  return text.split(/(\s+)/).filter((w) => w.length > 0);
}

function stripPunct(word: string): string {
  return word.replace(/[^\p{L}\p{N}']/gu, '').toLowerCase();
}

function ContentLine({ beat, animate }: { beat: ContentFormalBeat; animate: boolean }) {
  const s = STYLE[beat.style];
  const words = toWords(beat.content);
  const emphasis = beat.emphasis ? stripPunct(beat.emphasis) : null;

  const [revealed, setRevealed] = useState(animate ? 0 : words.length);
  useEffect(() => {
    if (!animate) {
      setRevealed(words.length);
      return;
    }
    setRevealed(0);
    const timers = words.map((_, i) =>
      setTimeout(() => setRevealed((r) => Math.max(r, i + 1)), i * WORD_REVEAL_STAGGER_MS),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beat.content, animate]);

  return (
    <View style={styles.line}>
      {words.map((word, i) => {
        const isEmphasis = emphasis != null && stripPunct(word) === emphasis;
        return (
          <Text
            key={i}
            style={{
              fontFamily: isEmphasis ? FONT_BOLD : s.font,
              fontSize: s.fontSize,
              color: isEmphasis ? EMPHASIS_COLOR : s.color,
              opacity: i < revealed ? 1 : 0,
            }}
          >
            {word}
          </Text>
        );
      })}
    </View>
  );
}

/**
 * A formative check-in (§8.4). Controlled by the Board: `selectedIndex` is the
 * student's pick (undefined = unanswered), `onSelect` gates the board until they
 * answer. Once answered, the correct option is marked and — on a wrong pick — the
 * clarification tailored to that specific choice (§8.13) is shown. Getting it
 * wrong never penalizes; the Board re-teaches that part afterward (§9.2).
 * With no `onSelect` (dev/seek render) the options are inert.
 */
function CheckIn({
  beat,
  selectedIndex,
  onSelect,
}: {
  beat: CheckInBeat;
  selectedIndex?: number;
  onSelect?: (index: number) => void;
}) {
  const answered = selectedIndex !== undefined;
  const wasWrong = answered && selectedIndex !== beat.correct_index;
  const reaction = wasWrong ? beat.wrong_answer_reactions?.[String(selectedIndex)] : undefined;

  return (
    <View style={styles.checkIn}>
      <Text style={styles.question}>{beat.question}</Text>
      <View style={styles.options}>
        {beat.options.map((option, i) => {
          const isCorrect = answered && i === beat.correct_index;
          const isWrongPick = answered && i === selectedIndex && wasWrong;
          const borderColor = isCorrect ? CORRECT_COLOR : isWrongPick ? WRONG_COLOR : '#3a4256';
          const textColor = isCorrect ? CORRECT_COLOR : isWrongPick ? WRONG_COLOR : '#e6e8ee';
          return (
            <Pressable
              key={i}
              disabled={answered || !onSelect}
              onPress={() => onSelect?.(i)}
              accessibilityRole="button"
              style={[styles.option, { borderColor }, isCorrect && styles.optionCorrectFill]}
            >
              <Text style={[styles.optionText, { color: textColor }]}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
      {answered && wasWrong ? (
        <Text style={styles.reaction}>{reaction ?? "Not quite — let's look at that part again."}</Text>
      ) : null}
      {answered && !wasWrong ? <Text style={styles.correctNote}>Exactly right.</Text> : null}
    </View>
  );
}

export function FormalText({
  beat,
  animate,
  checkInSelected,
  onCheckInSelect,
}: {
  beat: FormalBeat;
  animate: boolean;
  checkInSelected?: number;
  onCheckInSelect?: (index: number) => void;
}) {
  if (beat.style === 'check_in_question') {
    return <CheckIn beat={beat} selectedIndex={checkInSelected} onSelect={onCheckInSelect} />;
  }
  return <ContentLine beat={beat} animate={animate} />;
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end', marginVertical: 6 },
  checkIn: { marginVertical: 12, alignSelf: 'stretch' },
  question: { fontFamily: FONT_REGULAR, fontSize: 27, color: '#ffffff', marginBottom: 12 },
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
  reaction: { fontFamily: FONT_REGULAR, fontSize: 20, color: WRONG_COLOR, marginTop: 12, lineHeight: 27 },
  correctNote: { fontFamily: FONT_SEMIBOLD, fontSize: 20, color: CORRECT_COLOR, marginTop: 12 },
});
