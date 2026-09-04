import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StudyPlan } from '../api/client';
import { strings, type Lang } from '../i18n';

/**
 * The lightweight main screen after sign-in (§8.12): results/progress and one
 * control that goes straight to the board — NOT a browsable list of topics. A
 * deliberately minimal grammar-only stat for v1 (topics done at the level); a
 * fuller dashboard waits on the multi-skill expansion (§6.2).
 */
export function DashboardScreen({
  name,
  plan,
  language,
  onStart,
  onSignOut,
}: {
  name: string | null;
  plan: StudyPlan;
  language: Lang;
  onStart: () => void;
  onSignOut: () => void;
}) {
  const t = strings[language];
  const { stats } = plan;
  const pct = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <View style={styles.root}>
      <Pressable onPress={onSignOut} style={styles.signOut} accessibilityRole="button">
        <Text style={styles.signOutText}>{t.signOut}</Text>
      </Pressable>

      <View style={styles.center}>
        <Text style={styles.greeting}>{t.greeting(name ?? '')}</Text>
        <Text style={styles.stat}>{t.dashboardStat(stats.completed, stats.total, stats.level)}</Text>

        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${pct}%` }]} />
        </View>

        <Pressable style={styles.cta} onPress={onStart} accessibilityRole="button">
          <Text style={styles.ctaText}>{t.dashboardStart}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#12151c' },
  signOut: { position: 'absolute', top: 14, right: 18, zIndex: 1 },
  signOutText: { color: '#5b6472', fontSize: 13, textDecorationLine: 'underline' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 18 },
  greeting: { fontSize: 32, fontWeight: '700', color: '#ffffff' },
  stat: { fontSize: 18, color: '#98a2b3' },
  barTrack: { width: '100%', maxWidth: 420, height: 8, borderRadius: 4, backgroundColor: '#232838', overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#5fd08a' },
  cta: { backgroundColor: '#5aa9ff', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28, marginTop: 8 },
  ctaText: { color: '#0b0e14', fontSize: 18, fontWeight: '600' },
});
