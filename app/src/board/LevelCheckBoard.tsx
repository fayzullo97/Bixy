import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { QuizQuestion } from './types';
import type { LevelCheckQuestion } from '../api/client';
import { NoteCard, QuizQuestionCard, type QuizAnswer } from './Quiz';
import { decideNext, finalPlacement, pickQuestion, SKIP_LEVEL, type Level } from './levelCheck';
import { FONT_SEMIBOLD } from './fonts';

// The level check (§8.11) on the board itself — no new screen. It reuses the
// fill-in-the-blank card the end-of-topic quiz already uses (§8.4): an append-only
// timeline of typed questions, each graded server-side, with the pure adaptive
// algorithm (levelCheck.ts) choosing the next level and the final placement.

type NoteTone = 'info' | 'success' | 'warn';
type Item =
  | { key: string; kind: 'note'; title: string; body?: string; tone: NoteTone }
  | { key: string; kind: 'question'; level: Level; q: QuizQuestion };

interface Props {
  /** The full pregenerated bank (§8.11), with accepted answers for grading. */
  questions: LevelCheckQuestion[];
  /** Question ids this student has already been shown — prefer-unseen (§8.11). */
  seen: string[];
  /** Server-backed grader (§8.11) — deterministic pass then AI fallback. */
  gradeFillIn: (q: QuizQuestion, answer: string) => Promise<boolean>;
  /** Record that a question was shown (best-effort). */
  onSeen: (questionId: string) => void;
  /** Persist the final placement when the test resolves. */
  onPlaced: (level: Level) => void;
}

export function LevelCheckBoard({ questions, seen, gradeFillIn, onSeen, onPlaced }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>({});
  const [placed, setPlaced] = useState<Level | null>(null);
  const [started, setStarted] = useState(false);

  const scrollRef = useRef<ScrollView | null>(null);
  const keyRef = useRef(0);
  const qIdRef = useRef(0);
  const usedRef = useRef<Set<string>>(new Set());
  const seenRef = useRef<Set<string>>(new Set(seen));
  const answeredRef = useRef<Array<{ level: Level; correct: boolean }>>([]);
  const bootRef = useRef(false);

  const mkKey = () => `lc-${keyRef.current++}`;

  const finish = useCallback(
    (level: Level) => {
      setPlaced(level);
      onPlaced(level);
      setItems((prev) => [
        ...prev,
        {
          key: mkKey(),
          kind: 'note',
          title: `Placed at ${level}`,
          body: "That's your starting level. You can retake the level check any time to update it.",
          tone: 'success',
        },
      ]);
    },
    [onPlaced],
  );

  // Ask the next question the algorithm chooses, or place when it resolves.
  const advance = useCallback(() => {
    const decision = decideNext(answeredRef.current);
    if (decision.kind === 'place') {
      finish(decision.level);
      return;
    }
    const picked = pickQuestion(decision.level, questions, seenRef.current, usedRef.current);
    if (!picked) {
      // The level's pool is exhausted — fall back to placing on what we have.
      finish(finalPlacement(answeredRef.current));
      return;
    }
    usedRef.current.add(picked.id);
    seenRef.current.add(picked.id);
    onSeen(picked.id);
    const q: QuizQuestion = {
      quiz_question_id: qIdRef.current++,
      type: 'fill_in_the_blank',
      question: picked.prompt,
      accepted_answers: picked.accepted_answers,
      tests_beat_id: 0,
    };
    setItems((prev) => [...prev, { key: mkKey(), kind: 'question', level: decision.level, q }]);
  }, [questions, finish, onSeen]);

  // Boot: intro note, then the opening question. Runs once.
  useEffect(() => {
    if (bootRef.current) return;
    bootRef.current = true;
    setItems([
      {
        key: mkKey(),
        kind: 'note',
        title: 'Level check',
        body: 'A quick placement test — type your answer to each blank. It adapts as you go.',
        tone: 'info',
      },
    ]);
    advance();
  }, [advance]);

  useEffect(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, [items]);

  const handleAnswer = useCallback(
    (key: string, level: Level, answer: QuizAnswer) => {
      setAnswers((m) => ({ ...m, [key]: answer }));
      answeredRef.current = [...answeredRef.current, { level, correct: answer.correct }];
      setStarted(true);
      advance();
    },
    [advance],
  );

  const skip = useCallback(() => {
    if (placed || started) return;
    finish(SKIP_LEVEL);
  }, [placed, started, finish]);

  return (
    <View style={styles.board}>
      {!placed && !started ? (
        <View style={styles.header}>
          <Pressable style={styles.skip} onPress={skip} accessibilityRole="button">
            <Text style={styles.skipText}>I'm a complete beginner</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {items.map((item) =>
          item.kind === 'note' ? (
            <NoteCard key={item.key} title={item.title} body={item.body} tone={item.tone} />
          ) : (
            <QuizQuestionCard
              key={item.key}
              q={item.q}
              index={0}
              total={0}
              label={`Level check • ${item.level}`}
              answer={answers[item.key]}
              onAnswer={(a) => handleAnswer(item.key, item.level, a)}
              gradeFillIn={gradeFillIn}
            />
          ),
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { flex: 1, backgroundColor: '#12151c' },
  header: { paddingHorizontal: 28, paddingTop: 20, alignItems: 'flex-end' },
  skip: {
    borderWidth: 1,
    borderColor: '#3a4256',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  skipText: { fontFamily: FONT_SEMIBOLD, fontSize: 15, color: '#98a2b3' },
  content: { paddingHorizontal: 28, paddingTop: 20, paddingBottom: 80, gap: 4 },
});
