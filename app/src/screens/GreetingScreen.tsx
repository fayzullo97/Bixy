import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { BixyCharacter } from '../character/BixyCharacter';
import { SkyBackground } from '../home/SkyBackground';
import { sky, space } from '../theme';
import { strings, type Lang } from '../i18n';
import { api } from '../api/client';
import { playNarration } from '../board/audio';

/**
 * The arrival screen (Part 07 §12 step 2): Bixy greets the student, who taps to
 * go on to the level check.
 *
 * **Localized**, because §12's language selection runs *ahead* of this screen —
 * by the time the greeting plays the student has already chosen Uzbek or
 * Russian, so there is a language to speak in. (A C1 placement later overrides
 * the content language to English per Part 01 §1; it does not retroactively
 * change what was said here.)
 *
 * **Spoken from a pre-generated clip, not live synthesis.** This used to POST
 * the on-screen string to the server and wait for a fresh TTS render, which put
 * ~5s of silence between the screen appearing and Bixy speaking — the first
 * thing a new student experienced was a dead screen. The greeting text is fixed,
 * so there was never anything per-visit to synthesize: the server now returns
 * one of a few pre-built clips (`GET /me/greeting-clip`) and playback starts on
 * mount. Generate them with the server's `npm run gen-greeting-clips`.
 *
 * **No student name.** Interpolating the Telegram profile name is what forced
 * live synthesis, and it was unreliable anyway — many Telegram profiles carry a
 * handle, an emoji, or nothing where a first name would go. The greeting is
 * generic and introduces Bixy instead, which also absorbs what the old
 * `firstMeeting` branch used to append. (Part 05 §7's five-question meeting is
 * untouched and still runs on the board.)
 *
 * While the clip plays, `speaking` is true: Bixy stays in Float+Breathe with
 * Look-Around suppressed (Part 06's standing rule — Bixy is addressing the
 * student) and the "tap to continue" hint stays hidden, since there's nothing to
 * do yet but listen. Both lift the instant playback ends, or immediately if
 * there's no session, no clip, or the audio fails to load.
 */
export function GreetingScreen({
  language,
  session,
  onContinue,
}: {
  language: Lang;
  /** Needed to fetch the clip. Null skips straight to the silent (not-speaking)
   *  state — used by the dev harness, which has no real session. */
  session: string | null;
  onContinue: () => void;
}) {
  const t = strings[language];
  const [speaking, setSpeaking] = useState(session != null);
  // The server sends the exact text of the clip it picked, so what is shown is
  // always what is said. The local string is only a fallback for a failed fetch.
  const [line, setLine] = useState(t.greetingGeneric);
  const cancelRef = useRef<() => void>(() => {});

  useEffect(() => {
    setLine(strings[language].greetingGeneric);
  }, [language]);

  useEffect(() => {
    cancelRef.current();
    if (!session) {
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    let active = true;

    (async () => {
      const clip = await api.getGreetingClip(session);
      if (!active) return;
      if (!clip) {
        // Nothing to play — fail open to the silent state rather than stranding
        // the tap hint behind a greeting that will never finish.
        setSpeaking(false);
        return;
      }
      setLine(clip.text);
      cancelRef.current = playNarration(clip.audio_url, () => {
        if (active) setSpeaking(false);
      });
    })();

    return () => {
      active = false;
      cancelRef.current();
    };
  }, [session, language]);

  return (
    <SkyBackground>
      <Pressable
        style={styles.root}
        onPress={onContinue}
        accessibilityRole="button"
        accessibilityLabel={t.greetingContinue}
      >
        <Text style={styles.hello}>{line}</Text>
        <BixyCharacter height={190} addressing={speaking} jumpOnMount />
        {speaking ? null : <Text style={styles.hint}>{t.greetingContinue}</Text>}
      </Pressable>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl, padding: space.lg },
  // Back to headline size: the variants are one clause now, so this is a short
  // line again rather than the paragraph the first (longer) pass needed.
  hello: {
    fontSize: 28,
    lineHeight: 38,
    fontWeight: '600',
    color: sky.heading,
    textAlign: 'center',
    maxWidth: 480,
  },
  hint: { fontSize: 16, fontWeight: '500', color: sky.hint },
});
