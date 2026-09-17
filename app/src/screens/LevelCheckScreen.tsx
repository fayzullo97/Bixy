import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { api, type LevelCheckQuestion } from '../api/client';
import { LevelCheckBoard } from '../board/LevelCheckBoard';
import { RadarChart } from '../board/RadarChart';
import { SkyBackground } from '../home/SkyBackground';
import type { Answered, Level } from '../board/levelCheck';
import { sky, space } from '../theme';
import { type Lang } from '../i18n';

/**
 * The real level check (§8.11), run for a signed-in student between the greeting
 * and the study plan (Part 07 §12 step 2).
 *
 * §12 adds the radar chart above the test as a pure visualization: a sector per
 * tier that grows as questions land. "This is a display layer only, not a second
 * scoring mechanism" — the adaptive algorithm and the final placement are exactly
 * what Part 05 §8 verified, untouched, and the radar just reads their input.
 *
 * On placement it persists the result — which builds the study plan server-side —
 * then hands the level up so §12's language step and reveal can run.
 */
export function LevelCheckScreen({
  session,
  language,
  onPlaced,
}: {
  session: string;
  language: Lang;
  /** The tier the test landed on; the caller drives what happens next (§12). */
  onPlaced: (level: Level) => void;
}) {
  const [questions, setQuestions] = useState<LevelCheckQuestion[] | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [answered, setAnswered] = useState<ReadonlyArray<Answered>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await api.getLevelCheck(session);
        if (!active) return;
        setQuestions(data.questions);
        setSeen(data.seen);
      } catch (e) {
        if (active) setError(String(e));
      }
    })();
    return () => {
      active = false;
    };
  }, [session]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!questions) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#5aa9ff" />
      </View>
    );
  }

  return (
    <SkyBackground>
      <View style={styles.root}>
        <Text style={styles.title}>Level Test</Text>
        <View style={styles.chart}>
          <RadarChart answered={answered} size={240} />
        </View>
        <View style={styles.board}>
          <LevelCheckBoard
            questions={questions}
            seen={seen}
            gradeFillIn={async (q, answer) => {
              const { correct } = await api.gradeFillIn(session, {
                question: q.question,
                accepted_answers: q.accepted_answers ?? [],
                answer,
              });
              return correct;
            }}
            onSeen={(questionId) => api.postLevelCheckSeen(session, questionId)}
            onAnswered={setAnswered}
            onPlaced={async (level: Level) => {
              // Persisting the placement rebuilds the study plan server-side (§8.12).
              await api.putLevelCheckPlacement(session, level);
              onPlaced(level);
            }}
          />
        </View>
      </View>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: space.xl },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: sky.heading,
    textAlign: 'center',
    marginBottom: space.sm,
  },
  chart: { alignItems: 'center' },
  board: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12151c', gap: 16, padding: 24 },
  error: { color: '#ff6b6b', fontSize: 16, textAlign: 'center' },
});
