import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { BixyCharacter } from '../character/BixyCharacter';
import { SkyBackground } from '../home/SkyBackground';
import { sky, space, text as textColor } from '../theme';
import { strings, type Lang } from '../i18n';
import { api } from '../api/client';
import { playNarration } from '../board/audio';

/**
 * The arrival screen (Part 07 §12 step 2): Bixy greets the student, who taps to
 * go on to the level check.
 *
 * **Localized**, because §12's language selection now runs *ahead* of this
 * screen rather than after the level check — by the time the greeting plays the
 * student has already chosen Uzbek or Russian, so there is a language to speak
 * in. (A C1 placement later overrides the content language to English per Part
 * 01 §1; it does not retroactively change what was said here.)
 *
 * For a student Bixy has never met (`metAt === null`), the greeting also carries
 * the **introduction** — its name and what it does — which Part 05 §7 used to
 * open the board's get-to-know-you with. A returning student gets the greeting
 * alone; the day-boundary full/short choice stays on the board, which is the
 * surface that owns `POST /me/greeting`.
 *
 * **Spoken, not just written.** On mount this fetches and plays a real
 * synthesis of exactly the text on screen (`POST /me/greeting-audio`). While it
 * plays, `speaking` is true: Bixy stays in Float+Breathe with Look-Around
 * suppressed (Part 06's standing rule — Bixy is addressing the student) and the
 * "tap to continue" hint stays hidden, since there's nothing to do yet but
 * listen. Both lift the instant playback ends (or immediately, if there's no
 * session to fetch audio with, or nothing came back) — `speaking` reflects
 * actual narration, not a permanently-suppressed idle.
 */
export function GreetingScreen({
  name,
  language,
  firstMeeting,
  session,
  onContinue,
}: {
  name: string | null;
  language: Lang;
  /** True when Bixy has not introduced itself yet (the user's `metAt` is null). */
  firstMeeting: boolean;
  /** Needed to fetch the spoken audio. Null skips straight to the silent
   *  (not-speaking) state — used by the dev harness, which has no real session. */
  session: string | null;
  onContinue: () => void;
}) {
  const t = strings[language];
  const [speaking, setSpeaking] = useState(session != null);
  const cancelRef = useRef<() => void>(() => {});

  useEffect(() => {
    cancelRef.current();
    if (!session) {
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    let active = true;
    let blobUrl: string | null = null;
    const spoken = firstMeeting ? `${t.greeting(name ?? '')}. ${t.bixyIntro}` : t.greeting(name ?? '');

    (async () => {
      const url = await api.getGreetingAudio(session, spoken);
      if (!active) return;
      if (!url) {
        // Nothing to play (no provider configured, or the request failed) —
        // fail open to the silent state rather than stranding the tap hint.
        setSpeaking(false);
        return;
      }
      blobUrl = url;
      cancelRef.current = playNarration(url, () => {
        if (active) setSpeaking(false);
      });
    })();

    return () => {
      active = false;
      cancelRef.current();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
    // Only the identity of what's being said should re-trigger playback, not
    // every render — `t` changes with `language`, which is exactly a re-say.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, firstMeeting, language, name]);

  return (
    <SkyBackground>
      <Pressable
        style={styles.root}
        onPress={onContinue}
        accessibilityRole="button"
        accessibilityLabel={t.greetingContinue}
      >
        <Text style={styles.hello}>{t.greeting(name ?? '')}</Text>
        <BixyCharacter height={190} addressing={speaking} jumpOnMount />
        {firstMeeting ? <Text style={styles.intro}>{t.bixyIntro}</Text> : null}
        {speaking ? null : <Text style={styles.hint}>{t.greetingContinue}</Text>}
      </Pressable>
    </SkyBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl, padding: space.lg },
  hello: { fontSize: 32, fontWeight: '700', color: sky.heading, textAlign: 'center' },
  intro: { fontSize: 16, lineHeight: 24, color: textColor.sub, textAlign: 'center', maxWidth: 480 },
  hint: { fontSize: 16, fontWeight: '500', color: sky.hint },
});
