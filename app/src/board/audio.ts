import { Platform } from 'react-native';

/**
 * Plays a narration WAV and calls `onEnd` when it finishes (§8.3 — narration
 * drives story-beat pacing). Web target only in v1; on native (or if autoplay is
 * blocked / the file errors) it falls back to calling `onEnd` so playback still
 * advances. Returns a cancel function that stops the audio.
 */
export function playNarration(url: string, onEnd: () => void): () => void {
  if (Platform.OS !== 'web' || typeof Audio === 'undefined') {
    onEnd();
    return () => {};
  }
  const audio = new Audio(url);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
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
    audio.removeEventListener('ended', finish);
    audio.removeEventListener('error', onError);
    audio.pause();
  };
}

// Narration URLs can be long signed/data URLs; keep console output readable.
function audioLabel(url: string): string {
  return url.length > 80 ? `${url.slice(0, 77)}…` : url;
}
