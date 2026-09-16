import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/AuthContext';
import { api, type LevelDetail, type LevelMap, type StudyPlan } from '../api/client';
import { isOffline } from '../net/offline';
import { strings, type Lang } from '../i18n';
import { asTopicLevel } from '../content/levels';
import type { Level } from '../board/levelCheck';
import { GreetingScreen } from './GreetingScreen';
import { LevelCheckScreen } from './LevelCheckScreen';
import { LanguageSelectScreen } from './LanguageSelectScreen';
import { RevealResultScreen } from './RevealResultScreen';
import { HomeScreen } from './HomeScreen';
import { AllLevelsScreen } from './AllLevelsScreen';
import { LevelScreen } from './LevelScreen';
import { PathBoardScreen } from './PathBoardScreen';

type Screen =
  | 'loading'
  | 'greeting'
  | 'levelcheck'
  | 'language'
  | 'reveal'
  | 'home'
  | 'alllevels'
  | 'level'
  | 'board'
  | 'error';

/**
 * The signed-in flow (§8.12, Part 07 §9/§12).
 *
 * §12's onboarding order, for a student with no plan yet:
 *   greeting → level test → language → reveal → home
 *
 * Language selection sits **after** the level check on purpose (§12): a C1
 * placement skips it entirely and is assigned English automatically, because C1
 * is already the fully-English tier (Part 01 §1) — which can only be decided once
 * the placement is known. A student who already has a plan skips the whole
 * onboarding and lands on the home screen.
 *
 * Note this screen does NOT own Part 05 §7's get-to-know-you conversation. §12
 * moves the *greeting* ahead of the level check; it says nothing about relocating
 * the five-question meeting, which still runs on the board where Part 05 put it
 * and which `POST /me/greeting` still gates on `first_meeting`.
 */
export function SignedInApp() {
  const { user, session, updateUser } = useAuth();
  const [view, setView] = useState<Screen>('loading');
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [levelMap, setLevelMap] = useState<LevelMap | null>(null);
  const [detail, setDetail] = useState<LevelDetail | null>(null);
  /** The tier whose screen is open — their own level, or one opened from the grid. */
  const [openLevel, setOpenLevel] = useState<Level | null>(null);
  /** The tier the level check just landed on, carried through §12's steps 3–4. */
  const [placed, setPlaced] = useState<Level | null>(null);
  const [offline, setOffline] = useState(false);
  const language = user?.appLanguage ?? 'en';
  const t = strings[language];

  const fail = useCallback(() => {
    // §8.10: say plainly whether it's a lost connection or a load failure, and
    // let the student retry — don't silently strand them on a spinner.
    setOffline(isOffline());
    setView('error');
  }, []);

  /**
   * Load the plan and, once placed, the current level's topics — the home screen
   * needs both, and fetching them together avoids a second spinner between the
   * level card appearing and the card deck filling in.
   */
  const loadHome = useCallback(async () => {
    if (!session) return;
    setView('loading');
    try {
      const p = await api.getStudyPlan(session);
      setPlan(p);
      if (!p) {
        // Unplaced: §12 starts at the greeting, not at the test.
        setView('greeting');
        return;
      }
      const level = asTopicLevel(p.level);
      if (!level) throw new Error(`unknown placement: ${p.level}`);
      setDetail(await api.getLevel(session, level));
      setOpenLevel(level);
      setView('home');
    } catch {
      fail();
    }
  }, [session, fail]);

  useEffect(() => {
    loadHome();
  }, [loadHome]);

  /**
   * §12 step 2 → 3: a C1 placement skips the language question and takes English
   * automatically; every other tier is asked.
   */
  const afterPlacement = useCallback(
    async (level: Level) => {
      setPlaced(level);
      if (level !== 'C1') {
        setView('language');
        return;
      }
      if (session) {
        try {
          updateUser(await api.setLanguage(session, 'en'));
        } catch {
          // A failed write leaves the server's derived language in place, which
          // is still a usable language — not a reason to block the reveal.
        }
      }
      setView('reveal');
    },
    [session, updateUser],
  );

  const chooseLanguage = useCallback(
    async (lang: Lang) => {
      if (!session) return;
      try {
        updateUser(await api.setLanguage(session, lang));
      } catch {
        fail();
        return;
      }
      setView('reveal');
    },
    [session, updateUser, fail],
  );

  const openAllLevels = useCallback(async () => {
    if (!session) return;
    try {
      setLevelMap(await api.getLevels(session));
      setView('alllevels');
    } catch {
      fail();
    }
  }, [session, fail]);

  const openLevelScreen = useCallback(
    async (level: Level) => {
      if (!session) return;
      try {
        setDetail(await api.getLevel(session, level));
        setOpenLevel(level);
        setView('level');
      } catch {
        fail();
      }
    },
    [session, fail],
  );

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
        <Pressable style={styles.cta} onPress={loadHome} accessibilityRole="button">
          <Text style={styles.ctaText}>{t.tryAgain}</Text>
        </Pressable>
      </View>
    );
  }

  if (view === 'greeting') {
    return <GreetingScreen name={user?.name ?? null} onContinue={() => setView('levelcheck')} />;
  }

  if (view === 'levelcheck') {
    return <LevelCheckScreen session={session} language={language} onPlaced={afterPlacement} />;
  }

  if (view === 'language') {
    return <LanguageSelectScreen onSelect={chooseLanguage} />;
  }

  if (view === 'reveal' && placed) {
    // §12: the reveal auto-advances to the main screen with no tap required.
    return <RevealResultScreen level={placed} language={language} onDone={loadHome} />;
  }

  if (view === 'board' && plan) {
    return (
      <PathBoardScreen
        session={session}
        name={user?.name ?? null}
        language={language}
        initialPlan={plan}
        onExit={loadHome}
      />
    );
  }

  if (view === 'alllevels' && levelMap) {
    return (
      <AllLevelsScreen
        map={levelMap}
        language={language}
        onBack={() => setView('home')}
        onOpenLevel={openLevelScreen}
      />
    );
  }

  if (view === 'level' && detail && openLevel) {
    return (
      <LevelScreen
        level={openLevel}
        detail={detail}
        language={language}
        onBack={() => setView(levelMap ? 'alllevels' : 'home')}
        // Opening a topic goes to the board, which serves whatever the path is
        // on — a locked row can't reach here, and a passed one re-opens its
        // lesson through the same resume the board already does.
        onOpenTopic={() => setView('board')}
      />
    );
  }

  if (view === 'home' && plan && detail && openLevel) {
    return (
      <HomeScreen
        level={openLevel}
        detail={detail}
        completed={plan.stats.completed}
        total={plan.stats.total}
        language={language}
        onOpenAllLevels={openAllLevels}
        onOpenLevel={openLevelScreen}
        onContinue={() => setView('board')}
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
