import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SkyBackground } from '../home/SkyBackground';
import { ProgressRing } from '../home/ProgressRing';
import { DISPLAY_LEVELS, levelMeta } from '../content/levels';
import type { Level } from '../board/levelCheck';
import type { LevelMap, LevelSummary } from '../api/client';
import { asset, radius, space, status as statusTokens, surface, text } from '../theme';
import { strings, type Lang } from '../i18n';

/**
 * The All Levels screen (Part 07 §9), reached from the home screen's level card.
 * A grid of every tier with its own progress; tapping one opens that tier's
 * screen.
 *
 * Every tier is openable, including ones the student hasn't reached — §9 says a
 * student can *see* what's ahead, and only *opening a topic* is gated. What a
 * not-yet-reached tier shows is its topic list with every row locked.
 */
export function AllLevelsScreen({
  map,
  language,
  onBack,
  onOpenLevel,
}: {
  map: LevelMap;
  language: Lang;
  onBack: () => void;
  onOpenLevel: (level: Level) => void;
}) {
  const t = strings[language];
  const byLevel = new Map(map.levels.map((l) => [l.level, l]));

  return (
    <SkyBackground>
      <BackBar label={t.back} onPress={onBack} />
      <ScrollView contentContainerStyle={styles.grid}>
        {DISPLAY_LEVELS.map((level) => (
          <LevelTile
            key={level}
            level={level}
            summary={byLevel.get(level)}
            onPress={() => onOpenLevel(level)}
          />
        ))}
      </ScrollView>
    </SkyBackground>
  );
}

function LevelTile({
  level,
  summary,
  onPress,
}: {
  level: Level;
  summary: LevelSummary | undefined;
  onPress: () => void;
}) {
  const meta = levelMeta(level);
  const completed = summary?.completed ?? 0;
  const total = summary?.total ?? 0;
  const percent = total > 0 ? (completed / total) * 100 : 0;

  return (
    <Pressable style={styles.tile} onPress={onPress} accessibilityRole="button">
      <View style={styles.tileHeader}>
        <Text style={[styles.tileLevel, { color: meta.accent }]}>{level}</Text>
        <TileStatus status={summary?.status ?? 'not_started'} percent={percent} />
      </View>
      <View style={[styles.tileBand, { backgroundColor: meta.tint }]} />
      <Text style={styles.tileName}>{meta.name}</Text>
      <Text style={styles.tileDescription}>{meta.description}</Text>
    </Pressable>
  );
}

function TileStatus({ status, percent }: { status: LevelSummary['status']; percent: number }) {
  if (status === 'completed') return <Img src={asset.check} size={26} label="Completed" />;
  if (status === 'in_progress') return <ProgressRing percent={percent} size={26} />;
  return <Img src={asset.ringEmpty} size={26} label="Not started" dimmed />;
}

function BackBar({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.back} onPress={onPress} accessibilityRole="button">
      <Text style={styles.backChevron}>‹</Text>
      <Text style={styles.backLabel}>{label}</Text>
    </Pressable>
  );
}

function Img({ src, size, label, dimmed }: { src: string; size: number; label: string; dimmed?: boolean }) {
  if (Platform.OS !== 'web') return null;
  return (
    <img
      src={src}
      alt={label}
      width={size}
      height={size}
      style={{ display: 'block', flexShrink: 0, opacity: dimmed ? 0.5 : 1 }}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    justifyContent: 'center',
  },
  tile: {
    width: 175,
    backgroundColor: surface.card,
    borderWidth: 1,
    borderColor: surface.cardBorder,
    borderRadius: radius.tile,
    paddingHorizontal: space.lg,
    paddingVertical: space.xl,
    gap: space.md,
  },
  tileHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  tileLevel: { fontSize: 26, fontWeight: '700', lineHeight: 28, letterSpacing: -0.6 },
  tileBand: { height: 56, borderRadius: radius.tile },
  tileName: {
    fontSize: 20,
    fontWeight: '600',
    color: statusTokens.pending,
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  tileDescription: { fontSize: 10, lineHeight: 12, color: text.slate, textAlign: 'center' },
});
