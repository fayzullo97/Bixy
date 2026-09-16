import { useEffect, useRef } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BixyCharacter } from '../character/BixyCharacter';
import { SkyBackground } from '../home/SkyBackground';
import { levelMeta } from '../content/levels';
import type { Level } from '../board/levelCheck';
import { sky, space } from '../theme';
import { strings, type Lang } from '../i18n';

/** How long the reveal holds before it advances itself (§12: no tap required). */
export const REVEAL_HOLD_MS = 3600;
const FADE_MS = 700;
const RISE_MS = 900;

/**
 * "Reveal the Result" (Part 07 §12 step 4): the placed level animates in, then
 * the screen auto-advances to the home screen with no tap.
 *
 * §12 points at a Figma Motion frame named "Reveal the result" as the source of
 * truth for the animation's timing. That frame renders (a headline over the tier
 * letters and Bixy) but exposes no children or motion tracks through the MCP
 * API — there is no timing to read out of it, so the beats below are built to
 * the frame's *composition* and given straightforward timings. If the Motion
 * spec becomes readable, these three constants are what it would replace.
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
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    const timer = setTimeout(() => done.current(), REVEAL_HOLD_MS);
    return () => clearTimeout(timer);
  }, [level]);

  return (
    <SkyBackground>
      <View style={styles.root} accessibilityLiveRegion="polite">
        {Platform.OS === 'web' ? <style>{KEYFRAMES}</style> : null}

        <View style={styles.headline}>
          <Text style={[styles.lead, animated('reveal-fade', 0)]}>{t.revealLead}</Text>
          <Text style={[styles.level, animated('reveal-fade', 220)]}>{meta.name}</Text>
        </View>

        <View style={styles.stage}>
          <Text style={[styles.glyph, { color: meta.accent }, animated('reveal-rise', 420)]}>
            {level}
          </Text>
          <View style={styles.bixy}>
            {/* Bixy is addressing the student with the result, so Look-Around
                stays suppressed here the same way it is on the greeting. */}
            <BixyCharacter height={150} addressing />
          </View>
        </View>
      </View>
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
  stage: { alignItems: 'center', justifyContent: 'center', height: 240 },
  glyph: { fontSize: 120, fontWeight: '700', lineHeight: 130, letterSpacing: -4 },
  bixy: { position: 'absolute', bottom: 0 },
});
