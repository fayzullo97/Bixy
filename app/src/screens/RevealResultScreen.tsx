import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BixyCharacter } from '../character/BixyCharacter';
import { SkyBackground } from '../home/SkyBackground';
import { levelMeta } from '../content/levels';
import type { Level } from '../board/levelCheck';
import { sky, space } from '../theme';
import { strings, type Lang } from '../i18n';

const FADE_MS = 700;
const RISE_MS = 900;

/**
 * "Reveal the Result" (Part 07 §12 step 4): the placed level animates in.
 *
 * §12 points at a Figma Motion frame named "Reveal the result" as the source of
 * truth for the animation's timing. That frame renders (a headline over the tier
 * letters and Bixy) but exposes no children or motion tracks through the MCP
 * API — there is no timing to read out of it, so the entrance beats below are
 * built to the frame's *composition* and given straightforward timings. Its
 * rendered PNG IS readable, though, and settled two things a blind guess
 * couldn't have: the tier glyph sits IN FRONT of Bixy (not behind — confirmed by
 * pixel-sampling the reference screenshot, where the glyph's strokes paint
 * unbroken over Bixy's body), and Bixy's top edge lines up with the glyph's
 * vertical center. `stage` below is sized so that relationship (`bixy.top`
 * measured from the glyph's own center, which `justifyContent: 'center'`
 * always places at exactly half of `stage`'s height) holds regardless of
 * either element's own size.
 *
 * Advancing is an explicit tap, not a timer: this used to auto-advance after a
 * fixed hold, which fired whether or not the student had actually looked at the
 * result.
 */
export function RevealResultScreen({
  level,
  language,
  onDone,
}: {
  level: Level;
  language: Lang;
  onDone: () => void;
}) {
  const t = strings[language];
  const meta = levelMeta(level);

  return (
    <SkyBackground>
      <Pressable
        style={styles.root}
        onPress={onDone}
        accessibilityRole="button"
        accessibilityLabel={t.revealContinue}
        accessibilityLiveRegion="polite"
      >
        {Platform.OS === 'web' ? <style>{KEYFRAMES}</style> : null}

        <View style={styles.headline}>
          <Text style={[styles.lead, animated('reveal-fade', 0)]}>{t.revealLead}</Text>
          <Text style={[styles.level, animated('reveal-fade', 220)]}>{meta.name}</Text>
        </View>

        <View style={styles.stage}>
          <View style={styles.bixy}>
            {/* Bixy is addressing the student with the result, so Look-Around
                stays suppressed here the same way it is on the greeting. */}
            <BixyCharacter height={150} addressing />
          </View>
          <Text style={[styles.glyph, { color: meta.accent }, animated('reveal-rise', 420)]}>
            {level}
          </Text>
        </View>

        <Text style={styles.hint}>{t.revealContinue}</Text>
      </Pressable>
    </SkyBackground>
  );
}

/** Web-only entrance animation; off-web the content is simply already in place. */
function animated(name: string, delay: number) {
  if (Platform.OS !== 'web') return null;
  return {
    animationName: name,
    animationDuration: `${name === 'reveal-rise' ? RISE_MS : FADE_MS}ms`,
    animationDelay: `${delay}ms`,
    animationFillMode: 'both',
    animationTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
  } as never;
}

const KEYFRAMES = `
@keyframes reveal-fade {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes reveal-rise {
  from { opacity: 0; transform: translateY(40px) scale(0.92); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  @keyframes reveal-fade { from { opacity: 1; } to { opacity: 1; } }
  @keyframes reveal-rise { from { opacity: 1; } to { opacity: 1; } }
}
`;

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl },
  headline: { alignItems: 'center', gap: space.xs },
  lead: { fontSize: 24, fontWeight: '600', color: sky.heading },
  level: { fontSize: 34, fontWeight: '700', color: sky.heading, textAlign: 'center' },
  // 300 = 2x Bixy's own height: with the glyph centered (its middle always at
  // exactly stage.height / 2) and `bixy.top: '50%'` starting Bixy's box at that
  // same midpoint, this is the smallest height that lets Bixy's full 150px
  // fit below it without spilling past the box.
  stage: { alignItems: 'center', justifyContent: 'center', height: 300 },
  glyph: {
    position: 'relative',
    zIndex: 2, // paints over Bixy — see the file doc comment.
    fontSize: 120,
    fontWeight: '700',
    lineHeight: 130,
    letterSpacing: -4,
  },
  bixy: { position: 'absolute', top: '50%', zIndex: 1 },
  hint: { fontSize: 16, fontWeight: '500', color: sky.hint },
});
