import { useState, type ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { AuthProvider, useAuth } from './src/auth/AuthContext';
import { OpenInTelegramScreen } from './src/screens/OpenInTelegramScreen';
import { SignedInApp } from './src/screens/SignedInApp';
import { DevBoardScreen } from './src/screens/DevBoardScreen';
import { DevLevelCheckScreen } from './src/screens/DevLevelCheckScreen';
import { DevBixyScreen } from './src/screens/DevBixyScreen';
import { DevHomeScreen, type DevHomeScreenName } from './src/screens/DevHomeScreen';
import { FullscreenFrame } from './src/telegram/FullscreenFrame';
import { BoardHost } from './src/board/BoardHost';
import type { Lang } from './src/i18n';
import { devRoutesEnabled } from './src/dev/enabled';

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
  if (!devRoutesEnabled() || typeof window === 'undefined') return null;
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
  if (!devRoutesEnabled() || typeof window === 'undefined') return null;
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

// DEV-ONLY: `?dev=bixy` renders the character (Part 06 §10) with the reference
// preview's controls, for comparing the port against it. `anger=0..100` sets the
// initial morph amount so a screenshot can be taken at a fixed value.
// DEV-ONLY: `?dev=home` renders Part 07's screens over fixed data. `screen=flow`
// walks §12's onboarding order; `screen=home|alllevels|level|greeting|language|reveal`
// opens one screen directly for a screenshot.
function devHomeParams(): { screen: DevHomeScreenName } | null {
  if (!devRoutesEnabled() || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('dev') !== 'home') return null;
  const screen = params.get('screen');
  const known: DevHomeScreenName[] = ['home', 'alllevels', 'level', 'greeting', 'language', 'reveal', 'flow'];
  return { screen: known.includes(screen as DevHomeScreenName) ? (screen as DevHomeScreenName) : 'home' };
}

function devBixyParams(): { anger: number } | null {
  if (!devRoutesEnabled() || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('dev') !== 'bixy') return null;
  const anger = Number(params.get('anger') ?? 0);
  return { anger: Number.isFinite(anger) ? Math.max(0, Math.min(1, anger / 100)) : 0 };
}

function Root() {
  const { status } = useAuth();
  // `loading` covers both restoring a saved session and the silent Mini App
  // auto-login (§8.8) — a spinner, no login form. `needsTelegram`/`error` fall to
  // the "open in Telegram" screen (which also offers a retry / the dev seam).
  if (status === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#5aa9ff" />
      </View>
    );
  }
  return status === 'signedIn' ? <SignedInApp /> : <OpenInTelegramScreen />;
}

export default function App() {
  const home = devHomeParams();
  if (home) {
    return (
      <View style={styles.devHomeRoot}>
        <StatusBar style="dark" />
        <DevHomeScreen screen={home.screen} />
      </View>
    );
  }
  const bixy = devBixyParams();
  if (bixy) {
    return (
      <View style={styles.devRoot}>
        <StatusBar style="light" />
        <DevBixyScreen anger={bixy.anger} />
      </View>
    );
  }
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
      {/* Part 08 §15: fullscreen on launch, insets respected, manual exit. Wraps
          only the real app — the dev routes above return before this point, so a
          screenshot run never fights Telegram for the window. */}
      <FullscreenFrame>
        <Root />
      </FullscreenFrame>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12151c' },
  devRoot: { flex: 1, backgroundColor: '#12151c' },
  devHomeRoot: { flex: 1, backgroundColor: '#ffffff' },
  tapGate: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12151c', padding: 28, gap: 14 },
  tapButton: { backgroundColor: '#5aa9ff', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32 },
  tapButtonText: { color: '#0b0e14', fontSize: 18, fontWeight: '600' },
  tapHint: { color: '#5b6472', fontSize: 13, textAlign: 'center', maxWidth: 360 },
});
