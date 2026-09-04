import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { api, type StudyPlan } from '../api/client';
import { isOffline } from '../net/offline';
import { strings } from '../i18n';
import { LevelCheckScreen } from './LevelCheckScreen';
import { DashboardScreen } from './DashboardScreen';
import { PathBoardScreen } from './PathBoardScreen';

type Screen = 'loading' | 'levelcheck' | 'dashboard' | 'board' | 'error';

/**
 * The signed-in flow (§8.12): a student with no study plan yet is unplaced, so
 * they take the level check (§8.11) first; once placed, the dashboard is the main
 * screen, and its one control goes to the board. All real navigation still runs
 * through the board — this coordinator only routes between the three states.
 */
export function SignedInApp() {
  const { user, session, signOut } = useAuth();
  const [view, setView] = useState<Screen>('loading');
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [offline, setOffline] = useState(false);
  const language = user?.appLanguage ?? 'en';
  const t = strings[language];

  // Load the plan; its absence means the student hasn't been placed yet (§8.12).
  const loadPlan = useCallback(async () => {
    if (!session) return;
    setView('loading');
    try {
      const p = await api.getStudyPlan(session);
      setPlan(p);
      setView(p ? 'dashboard' : 'levelcheck');
    } catch {
      // §8.10: say plainly whether it's a lost connection or a load failure, and
      // let the student retry — don't silently strand them on a spinner.
      setOffline(isOffline());
      setView('error');
    }
  }, [session]);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  if (!session || view === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#5aa9ff" />
      </View>
    );
  }

  if (view === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{offline ? t.offline : t.planLoadFailed}</Text>
        <Pressable style={styles.cta} onPress={loadPlan} accessibilityRole="button">
          <Text style={styles.ctaText}>{t.tryAgain}</Text>
        </Pressable>
      </View>
    );
  }

  if (view === 'levelcheck') {
    return <LevelCheckScreen session={session} language={language} onPlaced={loadPlan} />;
  }

  if (view === 'board' && plan) {
    return (
      <PathBoardScreen
        session={session}
        name={user?.name ?? null}
        language={language}
        initialPlan={plan}
        onExit={loadPlan}
      />
    );
  }

  // dashboard (default once placed)
  if (plan) {
    return (
      <DashboardScreen
        name={user?.name ?? null}
        plan={plan}
        language={language}
        onStart={() => setView('board')}
        onSignOut={signOut}
      />
    );
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator color="#5aa9ff" />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12151c', padding: 24, gap: 16 },
  error: { color: '#ff6b6b', fontSize: 16, textAlign: 'center' },
  cta: { backgroundColor: '#5aa9ff', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24 },
  ctaText: { color: '#0b0e14', fontSize: 16, fontWeight: '600' },
});
