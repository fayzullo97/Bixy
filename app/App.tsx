import { useState, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { SignInScreen } from './src/screens/SignInScreen';
import { SignedInApp } from './src/screens/SignedInApp';
import { DevBoardScreen } from './src/screens/DevBoardScreen';
import { DevLevelCheckScreen } from './src/screens/DevLevelCheckScreen';
import { BoardHost } from './src/board/BoardHost';
import type { Lang } from './src/i18n';

// DEV-ONLY: `?dev=board` renders the board without the auth gate for local
// screenshots. Add `topic=<id>` (or `text=<phrase>`) + `lang=en|uz|ru` to
// generate a real lesson; omit them for the static §8.2 sample. `?beat=N` shows
// beats 1..N statically (no animation); `?subtitles=1` shows the narration strip.
function devBoardParams(): {
  seekTo?: number;
  subtitles: boolean;
  topic?: string;
  text?: string;
  lang: Lang;
  resume: boolean;
} | null {
  if (
    Platform.OS !== 'web' ||
    process.env.EXPO_PUBLIC_DEV_LOGIN !== '1' ||
    typeof window === 'undefined'
  ) {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get('dev') !== 'board') return null;
  const beat = params.get('beat');
  const langParam = params.get('lang');
  const lang: Lang = langParam === 'uz' || langParam === 'ru' ? langParam : 'en';
  return {
    seekTo: beat ? Number(beat) : undefined,
    subtitles: params.get('subtitles') === '1',
    topic: params.get('topic') ?? undefined,
    text: params.get('text') ?? undefined,
    lang,
    // `resume=1` reads the saved last_completed_beat and picks up there — reload
    // mid-lesson to confirm the board comes back on the same beat (§8.9/§9.1).
    resume: params.get('resume') === '1',
  };
}

// DEV-ONLY: `?dev=levelcheck` runs the level check (§8.11) without the auth gate.
// Add `lang=en|uz|ru` (narration/UI copy); returns just the language when active.
function devLevelCheckParams(): { lang: Lang } | null {
  if (
    Platform.OS !== 'web' ||
    process.env.EXPO_PUBLIC_DEV_LOGIN !== '1' ||
    typeof window === 'undefined'
  ) {
    return null;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.get('dev') !== 'levelcheck') return null;
  const langParam = params.get('lang');
  const lang: Lang = langParam === 'uz' || langParam === 'ru' ? langParam : 'en';
  return { lang };
}

// DEV-ONLY: `?dev=board` loads straight into a lesson with no prior interaction, so
// the browser's autoplay policy blocks the first beat's narration. The real flow
// never hits this — sign-in and the on-board "Continue?" prompt (§8.12) are genuine
// clicks before any audio — so this one tap reproduces that gesture and makes the dev
// route behave like real usage instead of autoplaying on load.
function DevTapToStart({ children }: { children: ReactNode }) {
  const [started, setStarted] = useState(false);
  if (started) return <>{children}</>;
  return (
    <View style={styles.tapGate}>
      <Pressable style={styles.tapButton} onPress={() => setStarted(true)} accessibilityRole="button">
        <Text style={styles.tapButtonText}>Tap to start</Text>
      </Pressable>
      <Text style={styles.tapHint}>
        Dev route only — one tap satisfies the browser autoplay policy, matching the real sign-in flow.
      </Text>
    </View>
  );
}

function Root() {
  const { status } = useAuth();
  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#5aa9ff" />
      </View>
    );
  }
  return status === 'signedIn' ? <SignedInApp /> : <SignInScreen />;
}

export default function App() {
  const levelCheck = devLevelCheckParams();
  if (levelCheck) {
    return (
      <View style={styles.devRoot}>
        <StatusBar style="light" />
        <DevLevelCheckScreen language={levelCheck.lang} />
      </View>
    );
  }
  const dev = devBoardParams();
  if (dev) {
    const generate = dev.topic || dev.text;
    const content = generate ? (
      <DevBoardScreen
        topicId={dev.topic}
        text={dev.text}
        language={dev.lang}
        seekTo={dev.seekTo}
        showSubtitles={dev.subtitles}
        resume={dev.resume}
      />
    ) : (
      <BoardHost seekTo={dev.seekTo} showSubtitles={dev.subtitles} />
    );
    return (
      <View style={styles.devRoot}>
        <StatusBar style="light" />
        {/* Static screenshot mode (`?beat=N`) never autoplays and must render
            immediately — no gate. Otherwise gate on one tap (see DevTapToStart). */}
        {dev.seekTo != null ? content : <DevTapToStart>{content}</DevTapToStart>}
      </View>
    );
  }
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Root />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12151c' },
  devRoot: { flex: 1, backgroundColor: '#12151c' },
  tapGate: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12151c', padding: 28, gap: 14 },
  tapButton: { backgroundColor: '#5aa9ff', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  tapButtonText: { color: '#0b0e14', fontSize: 18, fontWeight: '600' },
  tapHint: { color: '#5b6472', fontSize: 13, textAlign: 'center', maxWidth: 360 },
});
