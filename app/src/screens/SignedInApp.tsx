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
  | 'language'
  | 'greeting'
  | 'levelcheck'
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
 *   language → greeting → level test → reveal → home
 *
 * Language selection runs **first** so everything after it — the greeting
 * included — speaks the student's own language. That is a reversal of what §12's
 * prose says (it put the question after the level check, on the grounds that the
 * greeting had no language to play in); see this part's build notes.
 *
 * A C1 placement still lands on English (Part 01 §1: C1 is the fully-English
 * tier), but as an **override applied after the placement** rather than as a
 * skipped question — the placement isn't known when the question is asked any
 * more. What already played in the chosen language, notably the greeting, is not
 * retroactively changed; only content from the reveal onward is affected.
 *
 * A student who already has a plan skips the whole onboarding and lands on home.
 *
 * Note this screen does NOT own Part 05 §7's get-to-know-you conversation. It
 * owns the *introduction* that used to open it (now folded into the greeting);
 * the five questions still run on the board, gated on `POST /me/greeting`
 * returning `first_meeting`.
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
        // Unplaced: onboarding starts at the language question, so that the
        // greeting immediately after it can be spoken in that language.
        setView('language');
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
   * Placement → reveal. A C1 placement overrides the content language to English
   * (Part 01 §1) on the way through, because the language question was answered
   * before the tier was known. The override is forward-looking only: the greeting
   * already played in whatever the student picked, and that stands.
   */
  const afterPlacement = useCallback(
    async (level: Level) => {
      setPlaced(level);
      if (level === 'C1' && session) {
        try {
          updateUser(await api.setLanguage(session, 'en'));
        } catch {
          // A failed write leaves the student's own choice in place, which is
          // still a usable language — not a reason to block the reveal.
        }
      }
      setView('reveal');
    },
    [session, updateUser],
  );

  /** Onboarding step 1. The greeting follows, and reads in what was picked here. */
  const chooseLanguage = useCallback(
    async (lang: Lang) => {
      if (!session) return;
      try {
        updateUser(await api.setLanguage(session, lang));
      } catch {
        fail();
        return;
      }
      setView('greeting');
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

  if (view === 'language') {
    return <LanguageSelectScreen onSelect={chooseLanguage} />;
  }

  if (view === 'greeting') {
    return (
      <GreetingScreen
        name={user?.name ?? null}
        language={language}
        // Bixy introduces itself here only if it hasn't already — the board's
        // conversation is what stamps `met_at`, so this stays true until then.
        firstMeeting={user?.metAt == null}
        session={session}
        onContinue={() => setView('levelcheck')}
      />
    );
  }

  if (view === 'levelcheck') {
    return <LevelCheckScreen session={session} language={language} onPlaced={afterPlacement} />;
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
