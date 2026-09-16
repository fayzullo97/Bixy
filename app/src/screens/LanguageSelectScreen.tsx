import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SkyBackground } from '../home/SkyBackground';
import { asset, radius, space, surface, text, sky } from '../theme';
import type { Lang } from '../i18n';

/**
 * Language selection (Part 07 §12 step 3), shown **after** the level check.
 *
 * Two options, Uzbek and Russian — §12 words the question as "Which language is
 * convenient to learn English, Uzbek or Russian?" and a C1 placement skips this
 * screen entirely (English is assigned automatically, since C1 is the fully
 * English tier per Part 01 §1). The Figma frame offers English as a third row;
 * that contradicts both the question it's captioned with and the C1 rule, so the
 * two options in the prose are what's built and English stays the automatic
 * outcome rather than a pick.
 *
 * The prompt is English for the same reason the greeting is: the student hasn't
 * chosen a language yet, so there is none to ask in.
 */
const OPTIONS: Array<{ lang: Lang; title: string; subtitle: string; flag: string }> = [
  { lang: 'uz', title: 'O‘zbek tili', subtitle: 'Darslar o‘zbek tilida tushuntiriladi', flag: '🇺🇿' },
  { lang: 'ru', title: 'Русский язык', subtitle: 'Уроки будут объясняться на русском языке', flag: '🇷🇺' },
];

export function LanguageSelectScreen({ onSelect }: { onSelect: (lang: Lang) => void }) {
  return (
    <SkyBackground>
      <ScrollView contentContainerStyle={styles.root}>
        <Text style={styles.title}>Select language</Text>
        <Text style={styles.question}>
          Which language is convenient to learn English, Uzbek or Russian?
        </Text>

        <View style={styles.options}>
          {OPTIONS.map((option) => (
            <Pressable
              key={option.lang}
              style={styles.option}
              onPress={() => onSelect(option.lang)}
              accessibilityRole="button"
            >
              <Text style={styles.flag}>{option.flag}</Text>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{option.title}</Text>
                <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
              </View>
              <Chevron />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SkyBackground>
  );
}

function Chevron() {
  if (Platform.OS !== 'web') return null;
  return <img src={asset.chevron} alt="" aria-hidden="true" width={24} height={24} style={{ display: 'block' }} />;
}

const styles = StyleSheet.create({
  root: { flexGrow: 1, justifyContent: 'center', padding: space.lg, gap: space.lg },
  title: { fontSize: 32, fontWeight: '700', color: sky.heading, textAlign: 'center' },
  question: { fontSize: 16, color: text.sub, textAlign: 'center', lineHeight: 22 },
  options: { gap: space.md, marginTop: space.lg },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: surface.card,
    borderRadius: radius.tile,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  flag: { fontSize: 32 },
  optionText: { flex: 1 },
  optionTitle: { fontSize: 16, fontWeight: '600', color: text.strong },
  optionSubtitle: { fontSize: 13, color: text.sub },
});
