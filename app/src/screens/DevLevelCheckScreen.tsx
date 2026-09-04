import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { api, type LevelCheckQuestion } from '../api/client';
import { LevelCheckBoard } from '../board/LevelCheckBoard';
import type { Level } from '../board/levelCheck';
import type { Lang } from '../i18n';

/**
 * DEV-ONLY: runs the level check (§8.11) end-to-end without the auth gate. Dev-
 * logs in for a session (the endpoints are authed), fetches the bank + this
 * student's seen ids + current placement, and drives the same adaptive board the
 * real signed-in flow will once the study plan (§7, Phase 7) gates it in.
 */
export function DevLevelCheckScreen({ language }: { language: Lang }) {
  const [session, setSession] = useState<string | null>(null);
  const [questions, setQuestions] = useState<LevelCheckQuestion[] | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [priorPlacement, setPriorPlacement] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { session } = await api.devLogin(language);
        if (!active) return;
        setSession(session);
        const data = await api.getLevelCheck(session);
        if (!active) return;
        setQuestions(data.questions);
        setSeen(data.seen);
        setPriorPlacement(data.placement);
      } catch (e) {
        if (active) setError(`Level check failed to load: ${String(e)}`);
      }
    })();
    return () => {
      active = false;
    };
  }, [language]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!session || !questions) {
    return (
      <View style={styles.center}>
        <Text style={styles.info}>Loading level check…</Text>
        <ActivityIndicator color="#5aa9ff" />
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {priorPlacement ? (
        <Text style={styles.prior}>Previously placed at {priorPlacement} — retaking.</Text>
      ) : null}
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
        onPlaced={(level: Level) => api.putLevelCheckPlacement(session, level)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#12151c' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12151c', gap: 12 },
  info: { color: '#98a2b3', fontSize: 15 },
  error: { color: '#ff6b6b', fontSize: 16, textAlign: 'center', paddingHorizontal: 24 },
  prior: {
    color: '#98a2b3',
    fontSize: 14,
    fontStyle: 'italic',
    paddingHorizontal: 28,
    paddingTop: 16,
  },
});
