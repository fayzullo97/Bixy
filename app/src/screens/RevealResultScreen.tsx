import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BixyCharacter } from '../character/BixyCharacter';
import { SkyBackground } from '../home/SkyBackground';
import { levelMeta } from '../content/levels';
import { JUMP_DURATION_MS } from '../character/idle';
import type { Level } from '../board/levelCheck';
import { sky, space } from '../theme';
import { strings, type Lang } from '../i18n';

const FADE_MS = 700;
const RISE_MS = 900;

/**
 * Bixy's jump owns the screen alone before any text appears. The level code
 * enters only once the jump's settle frame has landed, so the two never compete
 * for attention — nothing animates over a still-moving character.
 */
const SETTLED_MS = JUMP_DURATION_MS;
/** The level code first, then the words naming it. */
const HEADLINE_DELAY_MS = SETTLED_MS + 260;

/**
 * "Reveal the Result" (Part 07 §12 step 4): the placed level animates in.
 *
 * **Sequencing corrected from a screen recording of the intended animation.**
 * The previous build ran the entrance the other way round: the headline and the
 * tier glyph animated in from the first frame while Bixy sat static, and the
 * glyph was layered IN FRONT of Bixy (`zIndex: 2` over an absolutely-positioned
 * character) so its strokes painted across Bixy's body. The real sequence is:
 *
 *   1. Bixy plays its full jump — squash, launch, settle — completely alone,
 *      with no level text on screen at all.
 *   2. Once Bixy has settled, the tier glyph fades in BELOW it, in normal flow.
 *   3. The headline naming the tier follows.
 *
 * So the glyph is now a sibling underneath Bixy rather than an overlay on top of
 * it: no absolute positioning, no z-index stacking, no overlap. The earlier
 * front-of-Bixy layering came from pixel-sampling the static Figma PNG, which
 * shows a composed final state and cannot express order — the recording does,
 * and it wins.
 *
 * Everything after step 1 is gated by animation DELAY rather than by mounting
 * late: the nodes stay in the tree from the first frame (invisible, via
 * `animationFillMode: 'both'` over keyframes that start at `opacity: 0`), so the
 * layout never shifts as they arrive and Bixy does not move when the text lands.
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

        <View style={styles.stage}>
          {/* Bixy is addressing the student with the result, so Look-Around
              stays suppressed here the same way it is on the greeting. */}
          <BixyCharacter height={150} addressing jumpOnMount />
          <Text style={[styles.glyph, { color: meta.accent }, animated('reveal-rise', SETTLED_MS)]}>
            {level}
          </Text>
        </View>

        <View style={styles.headline}>
          <Text style={[styles.lead, animated('reveal-fade', HEADLINE_DELAY_MS)]}>
            {t.revealLead}
          </Text>
          <Text style={[styles.level, animated('reveal-fade', HEADLINE_DELAY_MS + 160)]}>
            {meta.name}
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
    // `both` is what keeps these invisible THROUGH the delay rather than only
    // after it — without it the glyph would be painted during Bixy's jump.
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
  from { opacity: 0; transform: translateY(18px) scale(0.92); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  @keyframes reveal-fade { from { opacity: 1; } to { opacity: 1; } }
  @keyframes reveal-rise { from { opacity: 1; } to { opacity: 1; } }
}
`;

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl },
  // A plain column: Bixy, then the glyph under it. The old version made this a
  // fixed-height overlap box so the glyph could sit across Bixy's middle; with
  // the glyph below, normal flow is all that's needed and the character's own
  // jump has room to travel without clipping.
  stage: { alignItems: 'center', gap: space.md },
  glyph: {
    fontSize: 120,
    fontWeight: '700',
    lineHeight: 130,
    letterSpacing: -4,
  },
  headline: { alignItems: 'center', gap: space.xs },
  lead: { fontSize: 24, fontWeight: '600', color: sky.heading },
  level: { fontSize: 34, fontWeight: '700', color: sky.heading, textAlign: 'center' },
  hint: { fontSize: 16, fontWeight: '500', color: sky.hint },
});
