import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api, type LevelCheckQuestion } from '../api/client';
import { LevelCheckBoard } from '../board/LevelCheckBoard';
import type { Level } from '../board/levelCheck';
import { strings, type Lang } from '../i18n';

/**
 * The real level check (§8.11), run for a signed-in student between sign-in and
 * the study plan (§8.12). Same adaptive board as the dev harness, but driven by
 * the live session. On placement it persists the result — which builds the study
 * plan server-side — then hands control back so the app can show the dashboard.
 */
export function LevelCheckScreen({
  session,
  language,
  onPlaced,
}: {
  session: string;
  language: Lang;
  onPlaced: () => void;
}) {
  const t = strings[language];
  const [questions, setQuestions] = useState<LevelCheckQuestion[] | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [placedLevel, setPlacedLevel] = useState<Level | null>(null);
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

  // Once placed, the board shows its result note; offer a clear step onward so the
  // student sees where they landed before the plan appears.
  if (placedLevel) {
    return (
      <View style={styles.center}>
        <Text style={styles.placed}>{t.levelPlaced(placedLevel)}</Text>
        <Pressable style={styles.cta} onPress={onPlaced} accessibilityRole="button">
          <Text style={styles.ctaText}>{t.toYourPlan}</Text>
        </Pressable>
      </View>
    );
  }

  return (
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
      onPlaced={async (level: Level) => {
        // Persisting the placement rebuilds the study plan server-side (§8.12).
        await api.putLevelCheckPlacement(session, level);
        setPlacedLevel(level);
      }}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12151c', gap: 16, padding: 24 },
  error: { color: '#ff6b6b', fontSize: 16, textAlign: 'center' },
  placed: { color: '#e6e8ee', fontSize: 22, textAlign: 'center' },
  cta: { backgroundColor: '#5aa9ff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  ctaText: { color: '#0b0e14', fontSize: 18, fontWeight: '600' },
});
