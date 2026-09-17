/**
 * Telegram fullscreen decisions (Part 08 §15) — pure, so the version gate, the
 * fallback and the inset maths are unit-tested without a Telegram client, which
 * is the only place the real behaviour can be observed.
 *
 * Fullscreen arrived in Bot API 8.0. Older clients have no `requestFullscreen`
 * at all, so they get `expand()` instead — the v1 behaviour, which is what the
 * app did unconditionally before this part.
 */

/** Bot API version that introduced requestFullscreen/exitFullscreen. */
export const FULLSCREEN_MIN_VERSION = '8.0';

/** One edge set, as Telegram reports both `safeAreaInset` and `contentSafeAreaInset`. */
export interface Inset {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export const ZERO_INSET: Inset = { top: 0, bottom: 0, left: 0, right: 0 };

/** The surface this module needs from `window.Telegram.WebApp`. All optional —
 *  an older client genuinely doesn't have most of it. */
export interface FullscreenCapableWebApp {
  isVersionAtLeast?: (version: string) => boolean;
  requestFullscreen?: () => void;
  exitFullscreen?: () => void;
  expand?: () => void;
  isFullscreen?: boolean;
  safeAreaInset?: Partial<Inset>;
  contentSafeAreaInset?: Partial<Inset>;
  onEvent?: (event: string, handler: (payload?: unknown) => void) => void;
  offEvent?: (event: string, handler: (payload?: unknown) => void) => void;
}

/** What to do on launch. `none` means neither call is available to us. */
export type LaunchAction = 'fullscreen' | 'expand' | 'none';

/**
 * Decide the launch action (§15).
 *
 * Both halves have to hold before we ask for fullscreen: the client must report
 * 8.0+, AND the method must actually be there. The version check alone isn't
 * enough — `isVersionAtLeast` is itself missing on old clients, and a client
 * that reports 8.0 without the method would throw on the call rather than fall
 * back. Requiring both means an unexpected client degrades to `expand()`
 * instead of breaking launch.
 */
export function decideLaunchAction(webApp: FullscreenCapableWebApp | null | undefined): LaunchAction {
  if (!webApp) return 'none';
  const supportsVersion = webApp.isVersionAtLeast?.(FULLSCREEN_MIN_VERSION) === true;
  if (supportsVersion && typeof webApp.requestFullscreen === 'function') return 'fullscreen';
  if (typeof webApp.expand === 'function') return 'expand';
  return 'none';
}

/** Normalize a partial/absent inset from the SDK into a complete one. */
export function normalizeInset(raw: Partial<Inset> | null | undefined): Inset {
  if (!raw) return ZERO_INSET;
  const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
  return { top: num(raw.top), bottom: num(raw.bottom), left: num(raw.left), right: num(raw.right) };
}

/**
 * The padding content should sit behind (§15: "so content doesn't collide with
 * OS window chrome").
 *
 * The two insets are summed rather than maxed. Telegram reports them as nested
 * regions — `safeAreaInset` is the device's own unsafe area (window chrome,
 * notch), and `contentSafeAreaInset` is the further inset from Telegram's own
 * UI drawn inside that. Taking the max would slide content under whichever of
 * the two is smaller.
 *
 * Returns zeroes when not fullscreen: outside fullscreen Telegram already lays
 * the Mini App out inside its chrome, so adding the insets would double the gap.
 */
export function contentPadding(
  isFullscreen: boolean,
  safeArea: Partial<Inset> | null | undefined,
  contentSafeArea: Partial<Inset> | null | undefined,
): Inset {
  if (!isFullscreen) return ZERO_INSET;
  const outer = normalizeInset(safeArea);
  const inner = normalizeInset(contentSafeArea);
  return {
    top: outer.top + inner.top,
    bottom: outer.bottom + inner.bottom,
    left: outer.left + inner.left,
    right: outer.right + inner.right,
  };
}

/**
 * How long to wait for `fullscreenChanged`/`fullscreenFailed` after asking,
 * before assuming the client answered neither and falling back to `expand()`.
 *
 * NOT in §15, which specifies the two events and no timeout. It's here because
 * the events are the only signal we get, and a client that fires neither would
 * leave the app at its default un-expanded size — strictly worse than v1, which
 * called `expand()` unconditionally. The fallback is safe to fire late: expanding
 * an already-fullscreen Mini App is a no-op, and the watchdog is cancelled the
 * moment either event arrives.
 */
export const FULLSCREEN_EVENT_TIMEOUT_MS = 1500;

/** Telegram events this module subscribes to. */
export const FULLSCREEN_EVENTS = {
  changed: 'fullscreenChanged',
  failed: 'fullscreenFailed',
  safeArea: 'safeAreaChanged',
  contentSafeArea: 'contentSafeAreaChanged',
} as const;

/**
 * Read the error out of a `fullscreenFailed` payload. Telegram documents
 * `{ error: 'UNSUPPORTED' | 'ALREADY_FULLSCREEN' }`, but the handler is called
 * with whatever the client sends, so this never assumes the shape.
 */
export function failureReason(payload: unknown): string {
  if (typeof payload === 'object' && payload !== null) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === 'string' && error.length > 0) return error;
  }
  return 'UNKNOWN';
}

/**
 * Whether a failure means fullscreen is simply not available, as opposed to the
 * request being redundant. `ALREADY_FULLSCREEN` is not a failure to recover
 * from — the app is in the state it asked for — so it must not trigger the
 * `expand()` fallback or hide the exit control.
 */
export function isUnsupportedFailure(payload: unknown): boolean {
  return failureReason(payload) !== 'ALREADY_FULLSCREEN';
}
