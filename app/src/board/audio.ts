import { Platform } from 'react-native';

/**
 * Plays a narration WAV and calls `onEnd` when it finishes (§8.3 — narration
 * drives story-beat pacing). Web target only in v1; on native (or if autoplay is
 * blocked / the file errors) it falls back to calling `onEnd` so playback still
 * advances. Returns a cancel function that stops the audio.
 */
export function playNarration(url: string, onEnd: () => void, onTime?: (ms: number) => void): () => void {
  if (Platform.OS !== 'web' || typeof Audio === 'undefined') {
    onEnd();
    return () => {};
  }
  const audio = new Audio(url);
  // Subtitle sync reads position on every frame (Part 02 §3). `timeupdate` fires
  // only ~4×/s, which the eye reads as the window stuttering behind the voice.
  let raf = 0;
  const tick = () => {
    onTime?.(audio.currentTime * 1000);
    raf = requestAnimationFrame(tick);
  };
  if (onTime && typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(tick);
  const stopTicking = () => {
    if (raf && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(raf);
    raf = 0;
  };
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    stopTicking();
    onEnd();
  };
  const onError = () => {
    // A load/decode failure (404, unsupported file) would otherwise advance the beat
    // silently — indistinguishable from a clip that finished. Surface it too.
    console.warn(`[audio] narration failed to load: ${audioLabel(url)}`, audio.error ?? '');
    finish();
  };
  audio.addEventListener('ended', finish);
  audio.addEventListener('error', onError);
  audio.play().catch((err: unknown) => {
    // Autoplay blocking rejects here with NotAllowedError, which looks identical to a
    // finished clip when swallowed — exactly what hid this bug (no console error, no
    // failed request). Log the real reason (the name separates an autoplay block from
    // a decode/abort error), then advance so a genuinely blocked lesson still proceeds.
    const name = err instanceof Error ? err.name : 'UnknownError';
    const message = err instanceof Error ? err.message : String(err);
    const hint = name === 'NotAllowedError' ? ' (autoplay blocked — needs a prior user gesture)' : '';
    console.warn(`[audio] play() rejected for ${audioLabel(url)}: ${name} — ${message}${hint}`);
    finish();
  });
  return () => {
    stopTicking();
    audio.removeEventListener('ended', finish);
    audio.removeEventListener('error', onError);
    audio.pause();
  };
}

// Narration URLs can be long signed/data URLs; keep console output readable.
function audioLabel(url: string): string {
  return url.length > 80 ? `${url.slice(0, 77)}…` : url;
}

/**
 * Plays a beat's clips back-to-back, calling `onEnd` once after the last one
 * (Part 02 §5 — a beat is now several clips: an English example, then the
 * localized note explaining it). Returns a cancel function that stops whichever
 * clip is currently playing and abandons the rest.
 *
 * A clip whose synthesis failed carries no URL; it's skipped rather than
 * stalling the beat. An empty list calls `onEnd` immediately, so the caller's
 * "did this beat narrate?" check stays a simple truthiness test on the result.
 *
 * Part 02 §3 replaces the gapless hand-off here with the 400ms splice.
 */
export function playSequence(
  urls: string[],
  onEnd: () => void,
  onTime?: (clipIndex: number, ms: number) => void,
): () => void {
  let index = 0;
  let cancelled = false;
  let stopCurrent: (() => void) | null = null;

  const next = () => {
    if (cancelled) return;
    if (index >= urls.length) {
      onEnd();
      return;
    }
    // Position is reported per clip, not cumulatively: each unit carries its own
    // word timings measured from its own start.
    const clipIndex = index;
    const url = urls[index++]!;
    stopCurrent = playNarration(url, next, onTime ? (ms) => onTime(clipIndex, ms) : undefined);
  };

  next();
  return () => {
    cancelled = true;
    stopCurrent?.();
  };
}

/** The playable clip URLs of a beat's speech, in order, skipping failed ones. */
export function clipUrls(speech?: { audio_url?: string }[]): string[] {
  return (speech ?? []).map((u) => u.audio_url).filter((u): u is string => Boolean(u));
}
