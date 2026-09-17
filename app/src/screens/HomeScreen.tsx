import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BixyCharacter } from '../character/BixyCharacter';
import { SkyBackground } from '../home/SkyBackground';
import { ProgressRing } from '../home/ProgressRing';
import { TopicCard } from '../home/TopicCard';
import { asset, sky, space, text } from '../theme';
import { levelMeta } from '../content/levels';
import type { Level } from '../board/levelCheck';
import type { LevelDetail, LevelTopic } from '../api/client';
import { strings, type Lang } from '../i18n';

/**
 * The redesigned home screen (Part 07 §9), replacing the v1 dashboard: a level
 * map card, Bixy, and a swipeable deck of topic-block cards.
 *
 * The three parts are independent tap targets — the level card opens All Levels,
 * Bixy resumes the lesson where it was left, and a card's title opens that
 * topic's level screen. There is still no topic browser: the deck shows the
 * student's own path and nothing else, and an upcoming card can be seen but not
 * opened (§9).
 */
export function HomeScreen({
  level,
  detail,
  completed,
  total,
  language,
  onOpenAllLevels,
  onOpenLevel,
  onContinue,
}: {
  level: Level;
  detail: LevelDetail;
  completed: number;
  total: number;
  language: Lang;
  onOpenAllLevels: () => void;
  onOpenLevel: (level: Level) => void;
  onContinue: () => void;
}) {
  const t = strings[language];
  const percent = total > 0 ? (completed / total) * 100 : 0;
  const meta = levelMeta(level);

  // The deck opens on the topic the path is serving, with cleared topics behind
  // it and upcoming ones ahead — swiping is how the student sees either (§9).
  const startIndex = useMemo(() => {
    const current = detail.topics.findIndex((x) => x.status === 'current');
    if (current !== -1) return current;
    return Math.max(0, detail.scroll_to ?? 0);
  }, [detail]);

  return (
    <SkyBackground>
      <View style={styles.root}>
        <Text style={styles.screenTitle}>{t.homeTitle}</Text>

        <Pressable style={styles.levelCard} onPress={onOpenAllLevels} accessibilityRole="button">
          <ProgressRing percent={percent} size={48} />
          <View style={styles.levelText}>
            <Text style={styles.levelName}>{t.homeLevelLabel(meta.level)}</Text>
            <Text style={styles.levelHint}>{t.homeLevelHint}</Text>
          </View>
          <Chevron />
        </Pressable>

        <Pressable
          style={styles.bixy}
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel={t.homeContinue}
        >
          <BixyCharacter height={190} jumpOnMount />
          <Text style={styles.tapHint}>{t.homeContinue}</Text>
        </Pressable>

        <TopicDeck
          topics={detail.topics}
          startIndex={startIndex}
          language={language}
          onOpenLevel={() => onOpenLevel(level)}
        />
      </View>
    </SkyBackground>
  );
}

/**
 * The swipeable card deck (§9). One card per topic, snapped to the viewport so a
 * swipe lands on exactly one neighbour rather than drifting between two.
 */
function TopicDeck({
  topics,
  startIndex,
  language,
  onOpenLevel,
}: {
  topics: LevelTopic[];
  startIndex: number;
  language: Lang;
  onOpenLevel: () => void;
}) {
  const t = strings[language];
  const scroller = useRef<ScrollView | null>(null);
  const [width, setWidth] = useState(() =>
    Platform.OS === 'web' ? Dimensions.get('window').width : 390,
  );

  const cardWidth = Math.min(width, 430) - space.lg * 2;
  const interval = cardWidth + space.md;

  // Open on the current topic without animating — the student should arrive at
  // their place, not watch the deck scroll to it.
  const jumpToStart = useCallback(() => {
    scroller.current?.scrollTo({ x: startIndex * interval, animated: false });
  }, [startIndex, interval]);

  useEffect(() => {
    jumpToStart();
  }, [jumpToStart]);

  if (topics.length === 0) {
    return (
      <View style={styles.deckEmpty}>
        <ActivityIndicator color={sky.hint} />
      </View>
    );
  }

  return (
    <ScrollView
      ref={scroller}
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={interval}
      snapToAlignment="start"
      contentContainerStyle={styles.deck}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={styles.deckScroll}
    >
      {topics.map((topic) => (
        <View key={topic.topic_id} style={{ width: cardWidth }}>
          <TopicCard topic={topic} label={deckLabel(topic, t)} onOpenLevel={onOpenLevel} />
        </View>
      ))}
    </ScrollView>
  );
}

function deckLabel(topic: LevelTopic, t: (typeof strings)['en']): string {
  if (topic.status === 'passed') return t.homeCardPassed;
  if (topic.status === 'locked') return t.homeCardUpcoming;
  return t.homeCardCurrent;
}

function Chevron() {
  if (Platform.OS !== 'web') return null;
  return <img src={asset.chevron} alt="" aria-hidden="true" width={24} height={24} style={{ display: 'block' }} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: space.xl },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: sky.heading,
    textAlign: 'center',
    marginBottom: space.md,
  },
  levelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: '#FFFFFF',
    marginHorizontal: space.lg,
    borderRadius: 20,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  levelText: { flex: 1 },
  levelName: { fontSize: 16, fontWeight: '600', color: text.strong },
  levelHint: { fontSize: 12, color: text.sub },
  bixy: { alignItems: 'center', justifyContent: 'center', paddingVertical: space.lg, gap: space.sm },
  tapHint: { fontSize: 16, color: sky.hint, fontWeight: '500' },
  deckScroll: { flexGrow: 0 },
  deck: { paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.xl },
  deckEmpty: { padding: space.xl, alignItems: 'center' },
});
