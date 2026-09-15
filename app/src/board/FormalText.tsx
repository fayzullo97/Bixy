import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CheckInBeat, ContentFormalBeat, ContentStyle, FormalBeat } from './types';
import { formalSegments } from './formalSegments';
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
// A `note` is Bixy's wording ABOUT the content, not the content itself, so it
// reads quieter than the English line it sits under.
const NOTE_COLOR = '#aab3c2';
const NOTE_FONT_SIZE = 21;

/** Splits into words while keeping the trailing space so wrapping looks natural. */
function toWords(text: string): string[] {
  return text.split(/(\s+)/).filter((w) => w.length > 0);
}

function stripPunct(word: string): string {
  return word.replace(/[^\p{L}\p{N}']/gu, '').toLowerCase();
}

/**
 * A formal beat's written lines (§8.3). A beat can now carry more than one line:
 * a common_mistake writes the wrong sentence and its correction, and most styles
 * can carry a localized `note` underneath (Part 01 §1). The word-by-word reveal
 * runs continuously ACROSS the lines, so a two-line beat still reads as one
 * thought being written rather than two blocks appearing independently.
 */
function ContentLine({ beat, animate }: { beat: ContentFormalBeat; animate: boolean }) {
  const segments = formalSegments(beat);
  // `start` is each line's offset into the beat's single continuous word stream,
  // so the reveal flows from one line into the next.
  let seen = 0;
  const lines = segments.map((seg) => {
    const words = toWords(seg.text);
    const start = seen;
    seen += words.length;
    return { ...seg, words, start };
  });
  const totalWords = seen;

  const [revealed, setRevealed] = useState(animate ? 0 : totalWords);
  useEffect(() => {
    if (!animate) {
      setRevealed(totalWords);
      return;
    }
    setRevealed(0);
    const timers = Array.from({ length: totalWords }, (_, i) =>
      setTimeout(() => setRevealed((r) => Math.max(r, i + 1)), i * WORD_REVEAL_STAGGER_MS),
    );
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments.map((seg) => seg.text).join('\u0000'), animate]);

  return (
    <View>
      {lines.map((line, li) => {
        const s = line.secondary
          ? { color: NOTE_COLOR, font: FONT_REGULAR, fontSize: NOTE_FONT_SIZE }
          : { ...STYLE[beat.style], ...(line.color ? { color: line.color } : {}) };
        const emphasis = line.emphasis ? stripPunct(line.emphasis) : null;
        return (
          <View key={li} style={[styles.line, line.secondary && styles.noteLine]}>
            {line.words.map((word, i) => {
              const isEmphasis = emphasis != null && stripPunct(word) === emphasis;
              return (
                <Text
                  key={i}
                  style={{
                    fontFamily: isEmphasis ? FONT_BOLD : s.font,
                    fontSize: s.fontSize,
                    color: isEmphasis ? EMPHASIS_COLOR : s.color,
                    opacity: line.start + i < revealed ? 1 : 0,
                  }}
                >
                  {word}
                </Text>
              );
            })}
          </View>
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
  noteLine: { marginTop: 2, marginBottom: 10 },
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
