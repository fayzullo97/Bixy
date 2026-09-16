import { useState } from 'react';
import type { LevelDetail, LevelMap, LevelTopic } from '../api/client';
import type { Level } from '../board/levelCheck';
import type { Lang } from '../i18n';
import { LEVELS } from '../board/levelCheck';
import { HomeScreen } from './HomeScreen';
import { AllLevelsScreen } from './AllLevelsScreen';
import { LevelScreen } from './LevelScreen';
import { GreetingScreen } from './GreetingScreen';
import { LanguageSelectScreen } from './LanguageSelectScreen';
import { RevealResultScreen } from './RevealResultScreen';

/**
 * DEV-ONLY harness for Part 07 — the home screens (§9) and the onboarding steps
 * (§12) wired to each other over fixed data, so each layout can be checked
 * without a session, a placement, or a seeded database.
 *
 * `?dev=home` walks the built order (language → greeting → reveal → home) so the
 * whole flow can be clicked through; `screen=` jumps straight to one screen.
 */
const TOPIC_IDS = [
  'present_simple_be',
  'present_simple',
  'articles_a_an',
  'prepositions_of_position',
  'question_tags',
  'which_that_vs_what_relative',
  'imperative',
  'have_got',
  'past_continuous',
  'the_definite_article',
];

function fakeTopics(passed: number, current: number): LevelTopic[] {
  return TOPIC_IDS.map((topic_id, i) => ({
    topic_id,
    status: i < passed ? 'passed' : i === current ? 'current' : 'locked',
    key_idea: `A short line explaining what ${topic_id.replace(/_/g, ' ')} is for, and when a student would use it.`,
  }));
}

const DETAIL: LevelDetail = { level: 'A1', topics: fakeTopics(3, 3), scroll_to: 3 };

const MAP: LevelMap = {
  placement: 'A1',
  levels: LEVELS.map((level, i) => ({
    level,
    status: i === 0 ? 'in_progress' : 'not_started',
    completed: i === 0 ? 3 : 0,
    total: 10,
  })),
};

export type DevHomeScreenName =
  | 'home'
  | 'alllevels'
  | 'level'
  | 'greeting'
  | 'language'
  | 'reveal'
  | 'flow';

export function DevHomeScreen({ screen = 'home' }: { screen?: DevHomeScreenName }) {
  const [view, setView] = useState<DevHomeScreenName>(screen === 'flow' ? 'language' : screen);
  const [level, setLevel] = useState<Level>('A1');
  // The greeting reads in whatever the language step picked, same as the real flow.
  const [lang, setLang] = useState<Lang>('en');

  if (view === 'language') {
    return (
      <LanguageSelectScreen
        onSelect={(picked) => {
          setLang(picked);
          setView('greeting');
        }}
      />
    );
  }

  if (view === 'greeting') {
    return (
      <GreetingScreen
        name="Fayzullo"
        language={lang}
        firstMeeting
        session={null}
        onContinue={() => setView('reveal')}
      />
    );
  }

  if (view === 'reveal') {
    return <RevealResultScreen level="A1" language="en" onDone={() => setView('home')} />;
  }

  if (view === 'alllevels') {
    return (
      <AllLevelsScreen
        map={MAP}
        language="en"
        onBack={() => setView('home')}
        onOpenLevel={(l) => {
          setLevel(l);
          setView('level');
        }}
      />
    );
  }

  if (view === 'level') {
    return (
      <LevelScreen
        level={level}
        detail={{ ...DETAIL, level }}
        language="en"
        onBack={() => setView('alllevels')}
        onOpenTopic={() => setView('home')}
      />
    );
  }

  return (
    <HomeScreen
      level="A1"
      detail={DETAIL}
      completed={3}
      total={10}
      language="en"
      onOpenAllLevels={() => setView('alllevels')}
      onOpenLevel={(l) => {
        setLevel(l);
        setView('level');
      }}
      onContinue={() => {}}
    />
  );
}
