import { Platform } from 'react-native';

/**
 * §8.9 best-effort save when the tab is hidden or closed. `visibilitychange` and
 * `pagehide` fire far more reliably than `beforeunload`, especially on the mobile
 * browsers this app targets. This is only a *backstop* — the primary strategy is
 * incremental saves after each beat / check-in / quiz, which Phase 3+ adds.
 *
 * Provided now as a ready seam: later phases pass a real flush function; there is
 * no lesson state to save yet, so nothing mounts this in Phase 1.
 */
export function registerHideBackstop(save: () => void): () => void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return () => {};
  }
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') save();
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', save);
  return () => {
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pagehide', save);
  };
}
