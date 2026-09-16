import { useCallback, useEffect, useRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SkyBackground } from '../home/SkyBackground';
import { levelMeta } from '../content/levels';
import { topicTitle, topicSubtitle } from '../content/topicTitle';
import type { Level } from '../board/levelCheck';
import type { LevelDetail, LevelTopic } from '../api/client';
import { asset, radius, space, surface, text } from '../theme';
import { strings, type Lang } from '../i18n';

/** Row height + gap, so the auto-scroll can land on a row without measuring. */
const ROW_HEIGHT = 64;
const ROW_GAP = 8;

/**
 * One level's screen (Part 07 §9): the tier's CEFR name and description over a
 * scrollable list of its topics, in the order the student's own path walks them.
 *
 * Only the student's **current** level auto-scrolls to their position on open —
 * a completed tier and a not-yet-reached one have nothing to scroll to, so they
 * open at the top. The server decides which case applies (`scroll_to`), because
 * it's the side that knows the placement.
 */
export function LevelScreen({
  level,
  detail,
  language,
  onBack,
  onOpenTopic,
}: {
  level: Level;
  detail: LevelDetail;
  language: Lang;
  onBack: () => void;
  onOpenTopic: (topic: LevelTopic) => void;
}) {
  const t = strings[language];
  const meta = levelMeta(level);
  const scroller = useRef<ScrollView | null>(null);
  const completed = detail.topics.filter((x) => x.status === 'passed').length;

  const scrollTo = detail.scroll_to;
  const applyAutoScroll = useCallback(() => {
    if (scrollTo === null || scrollTo <= 0) return;
    scroller.current?.scrollTo({ y: scrollTo * (ROW_HEIGHT + ROW_GAP), animated: false });
  }, [scrollTo]);

  useEffect(() => {
    applyAutoScroll();
  }, [applyAutoScroll]);

  return (
    <SkyBackground>
      <Pressable style={styles.back} onPress={onBack} accessibilityRole="button">
        <Text style={styles.backChevron}>‹</Text>
        <Text style={styles.backLabel}>{t.back}</Text>
      </Pressable>

      <ScrollView ref={scroller} contentContainerStyle={styles.body}>
        <Text style={[styles.watermark, { color: meta.tint }]}>{level}</Text>
        <Text style={styles.name}>{meta.name}</Text>
        <Text style={styles.description}>{meta.description}</Text>
        <Text style={styles.count}>{t.levelTopicCount(completed, detail.topics.length)}</Text>

        <View style={styles.rows}>
          {detail.topics.map((topic, index) => (
            <TopicRow
              key={topic.topic_id}
              topic={topic}
              index={index}
              accent={meta.accent}
              lockedHint={t.topicLocked}
              onPress={() => onOpenTopic(topic)}
            />
          ))}
        </View>
      </ScrollView>
    </SkyBackground>
  );
}

function TopicRow({
  topic,
  index,
  accent,
  lockedHint,
  onPress,
}: {
  topic: LevelTopic;
  index: number;
  accent: string;
  lockedHint: string;
  onPress: () => void;
}) {
  const locked = topic.status === 'locked';
  return (
    <Pressable
      style={[styles.row, locked && styles.rowLocked]}
      onPress={locked ? undefined : onPress}
      disabled={locked}
      accessibilityRole="button"
      accessibilityState={{ disabled: locked }}
      accessibilityHint={locked ? lockedHint : undefined}
    >
      <Text style={[styles.rowIndex, { color: locked ? text.disabled : accent }]}>
        {String(index + 1).padStart(2, '0')}
      </Text>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, locked && styles.dim]} numberOfLines={1}>
          {topicTitle(topic.topic_id)}
        </Text>
        <Text style={[styles.rowSubtitle, locked && styles.dim]} numberOfLines={1}>
          {topicSubtitle(topic.key_idea)}
        </Text>
      </View>
      <RowStatus status={topic.status} />
    </Pressable>
  );
}

function RowStatus({ status }: { status: LevelTopic['status'] }) {
  if (Platform.OS !== 'web') return null;
  const passed = status === 'passed';
  return (
    <img
      src={passed ? asset.check : asset.ringEmpty}
      alt={passed ? 'Passed' : status === 'locked' ? 'Locked' : 'In progress'}
      width={24}
      height={24}
      style={{ display: 'block', flexShrink: 0, opacity: status === 'locked' ? 0.5 : 1 }}
    />
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.xl,
    paddingBottom: space.sm,
  },
  backChevron: { fontSize: 24, color: text.strong, lineHeight: 26 },
  backLabel: { fontSize: 16, color: text.strong },
  body: { paddingBottom: space.xl * 2 },
  watermark: {
    fontSize: 96,
    fontWeight: '700',
    lineHeight: 104,
    paddingHorizontal: space.lg,
    letterSpacing: -2,
  },
  name: { fontSize: 32, fontWeight: '700', color: text.strong, paddingHorizontal: space.lg },
  description: {
    fontSize: 16,
    lineHeight: 22,
    color: text.sub,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  count: {
    fontSize: 13,
    color: text.disabled,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  rows: { paddingHorizontal: space.lg, paddingTop: space.lg, gap: ROW_GAP },
  row: {
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: surface.card,
    borderRadius: radius.row,
    paddingHorizontal: space.md,
  },
  rowLocked: { backgroundColor: surface.muted },
  rowIndex: { fontSize: 20, fontWeight: '600', width: 32 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: text.strong },
  rowSubtitle: { fontSize: 13, color: text.sub },
  dim: { color: text.disabled },
});
