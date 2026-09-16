import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LevelTopic } from '../api/client';
import { topicTitle } from '../content/topicTitle';
import { asset, radius, skillTint, space, surface, text } from '../theme';

/**
 * One topic-block card (Part 07 §9): the topic's name plus its five skill parts,
 * each with an icon, title, subtitle and status.
 *
 * Only **Grammar** is live. §9 is explicit that a topic completes when all five
 * parts pass but that "for MVP this collapses to just Grammar passing", with the
 * other four grayed, non-tappable and labelled coming soon — so Grammar carries
 * the topic's real status and the rest are inert. The Figma frame mocks Listening
 * up as in-progress; that's the design showing the finished product, not the
 * MVP, and §9's prose is what's built.
 */
interface Skill {
  key: keyof typeof skillTint;
  title: string;
  subtitle: string;
  icon: string;
  /** Rendered at the design's own leaf size inside the 48px tile. */
  iconWidth: number;
  iconHeight: number;
  /** Grammar is the only part with content behind it in v1. */
  live: boolean;
}

const SKILLS: Skill[] = [
  { key: 'grammar', title: 'Grammar', subtitle: 'Explanation and use cases', icon: asset.quote, iconWidth: 28, iconHeight: 20, live: true },
  { key: 'listening', title: 'Listening', subtitle: 'Audio clips and comprehension', icon: asset.listening, iconWidth: 32, iconHeight: 32, live: false },
  { key: 'speaking', title: 'Speaking', subtitle: 'Pronunciation and conversation', icon: asset.speaking, iconWidth: 32, iconHeight: 32, live: false },
  { key: 'reading', title: 'Reading', subtitle: 'Passages and comprehension', icon: asset.reading, iconWidth: 32, iconHeight: 32, live: false },
  { key: 'writing', title: 'Writing', subtitle: 'Sentences and composition', icon: asset.writing, iconWidth: 32, iconHeight: 32, live: false },
];

export function TopicCard({
  topic,
  label,
  onOpenLevel,
}: {
  topic: LevelTopic;
  /** "Current topic", or the passed/upcoming wording for a swiped-to card. */
  label: string;
  /** Tapping the title goes to the topic's level screen (§9). */
  onOpenLevel: () => void;
}) {
  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={onOpenLevel} accessibilityRole="button">
        <View style={styles.headerText}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {topicTitle(topic.topic_id)}
          </Text>
        </View>
        <Chevron />
      </Pressable>

      {SKILLS.map((skill) => (
        <View key={skill.key} style={styles.row}>
          <View style={[styles.iconTile, { backgroundColor: skillTint[skill.key] }]}>
            <Icon skill={skill} dimmed={!skill.live} />
          </View>
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, !skill.live && styles.dimText]} numberOfLines={1}>
              {skill.title}
            </Text>
            <Text style={[styles.rowSubtitle, !skill.live && styles.dimText]} numberOfLines={1}>
              {skill.live ? skill.subtitle : 'Coming soon'}
            </Text>
          </View>
          {skill.live ? <SkillStatus status={topic.status} /> : <EmptyRing />}
        </View>
      ))}
    </View>
  );
}

/** Grammar's indicator mirrors the topic's own status (§9's MVP collapse). */
function SkillStatus({ status }: { status: LevelTopic['status'] }) {
  if (status === 'passed') return <Img src={asset.check} size={24} label="Passed" />;
  if (status === 'locked') return <EmptyRing />;
  return <Img src={asset.ringEmpty} size={24} label="In progress" />;
}

function EmptyRing() {
  return <Img src={asset.ringEmpty} size={24} label="Not started" dimmed />;
}

function Icon({ skill, dimmed }: { skill: Skill; dimmed: boolean }) {
  if (Platform.OS !== 'web') return null;
  return (
    <img
      src={skill.icon}
      alt=""
      aria-hidden="true"
      width={skill.iconWidth}
      height={skill.iconHeight}
      style={{ display: 'block', opacity: dimmed ? 0.45 : 1 }}
    />
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

function Chevron() {
  if (Platform.OS !== 'web') return null;
  return <img src={asset.chevron} alt="" aria-hidden="true" width={24} height={24} style={{ display: 'block' }} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: surface.card,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headerText: { flex: 1 },
  label: { fontSize: 12, color: text.faint },
  title: { fontSize: 22, fontWeight: '700', color: text.strong, letterSpacing: -0.4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: radius.pill / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600', color: text.strong },
  rowSubtitle: { fontSize: 13, color: text.sub },
  dimText: { color: text.disabled },
});
