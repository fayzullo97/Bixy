import { Platform } from 'react-native';

/**
 * Telegram Mini App SDK bridge (§8.8, zero-friction login).
 *
 * This REPLACES the old Telegram Login Widget (oauth.telegram.org redirect +
 * phone-number prompt). The app is now only meant to be opened from inside
 * Telegram (bot menu button or a t.me link); Telegram injects a signed `initData`
 * string into the WebApp context, which we hand to our server to verify. There is
 * no login screen and no popup — identity is read straight from the context.
 *
 * The official SDK script (telegram-web-app.js) parses the launch parameters out
 * of the page URL hash and exposes them on `window.Telegram.WebApp`. We load it
 * dynamically (same pattern the old widget used) rather than assuming it's already
 * present.
 */
const SDK_SRC = 'https://telegram.org/js/telegram-web-app.js';

interface TelegramWebApp {
  /** Signed launch data as a raw query string. EMPTY when not launched by Telegram. */
  initData: string;
  initDataUnsafe?: { user?: { id?: number; language_code?: string } };
  ready: () => void;
  expand?: () => void;
  /** Bot API 8.0 fullscreen surface (Part 08 §15). Absent on older clients —
   *  `src/telegram/fullscreen.ts` owns the gating and the fallback. */
  isVersionAtLeast?: (version: string) => boolean;
  requestFullscreen?: () => void;
  exitFullscreen?: () => void;
  isFullscreen?: boolean;
  safeAreaInset?: { top?: number; bottom?: number; left?: number; right?: number };
  contentSafeAreaInset?: { top?: number; bottom?: number; left?: number; right?: number };
  onEvent?: (event: string, handler: (payload?: unknown) => void) => void;
  offEvent?: (event: string, handler: (payload?: unknown) => void) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/**
 * The in-flight (or settled) load, shared by every caller.
 *
 * This is the whole fix for a deadlock the previous version had: it re-attached
 * `load`/`error` listeners to an existing `<script>`, but those events fire
 * exactly once. A second caller arriving after the script had already settled
 * attached listeners to events that would never fire again, and its promise
 * never resolved OR rejected — so `getTelegramInitData` never returned, auth's
 * `bootstrap()` never set a status, and the app sat on its loading spinner
 * forever with no error state and no retry.
 *
 * That was unreachable while auth was the only caller. Part 08 §15 added a
 * second concurrent one (`useTelegramFullscreen`), which is exactly the race:
 * whichever consumer arrives second is the one that hangs.
 *
 * Caching the promise settles every caller with the same result regardless of
 * when they arrive — a resolved promise is still resolved for a caller that
 * awaits it minutes later, which listeners can't be.
 */
let sdkLoad: Promise<void> | null = null;

/** Records how an injected tag settled, so state survives past the one-shot events. */
const STATE_ATTR = 'data-sdk-state';

function loadSdk(): Promise<void> {
  // Already usable — whoever loaded it, there is nothing to wait for.
  if (window.Telegram?.WebApp) return Promise.resolve();
  if (sdkLoad) return sdkLoad;

  sdkLoad = new Promise<void>((resolve, reject) => {
    const fail = () => reject(new Error('Telegram SDK failed to load'));
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);

    if (existing) {
      // A tag from a previous attempt. Its events may already be spent, so trust
      // the recorded state over listeners — that read is what breaks the deadlock.
      const state = existing.getAttribute(STATE_ATTR);
      if (state === 'loaded') {
        resolve();
        return;
      }
      if (state === 'error') {
        // Drop the dead tag and fall through to injecting a fresh one. Resolving
        // the retry against the old failure would make the retry button a no-op:
        // it would report the previous network failure without re-attempting.
        existing.remove();
      } else {
        // Still in flight: its listeners haven't fired yet, so attaching is safe.
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', fail);
        return;
      }
    }

    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.setAttribute(STATE_ATTR, 'loading');
    script.addEventListener('load', () => {
      script.setAttribute(STATE_ATTR, 'loaded');
      resolve();
    });
    script.addEventListener('error', () => {
      script.setAttribute(STATE_ATTR, 'error');
      fail();
    });
    document.head.appendChild(script);
  });

  // A failed load must not poison the page for good: the "open in Telegram"
  // screen offers a retry, and that retry re-runs `bootstrap()`. Dropping the
  // cached rejection lets the next attempt genuinely re-try instead of being
  // handed the old failure.
  sdkLoad.catch(() => {
    sdkLoad = null;
  });

  return sdkLoad;
}

/**
 * Loads the SDK if needed and returns the `WebApp` object, or null when we're
 * not on web / the script can't load.
 *
 * Exported because the fullscreen hook (Part 08 §15) needs the SAME object and
 * mounts before auth finishes. The script is injected asynchronously, so a
 * consumer that just reads `window.Telegram?.WebApp` on mount finds nothing and
 * silently does nothing — `loadSdk` already de-duplicates concurrent callers and
 * an in-flight `<script>`, so both paths can await this safely.
 */
export async function ensureTelegramWebApp(): Promise<TelegramWebApp | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  try {
    await loadSdk();
  } catch {
    return null;
  }
  return window.Telegram?.WebApp ?? null;
}

/**
 * Loads the Telegram SDK, signals readiness, and returns the raw `initData`
 * string — or `null` when we're NOT running inside Telegram.
 *
 * NOTE on detection: loading the SDK script always defines `window.Telegram.WebApp`
 * (even in a plain browser), so its mere existence does NOT mean we're in Telegram.
 * The real signal is a NON-EMPTY, signed `initData` — a plain browser gets `''`.
 * That's what lets us show an "open from Telegram" message instead of a broken
 * login flow when someone visits the URL directly.
 */
export async function getTelegramInitData(): Promise<string | null> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }
  const webApp = await ensureTelegramWebApp();
  if (!webApp) return null;
  try {
    webApp.ready();
  } catch {
    // ready() is a best-effort chrome call; a failure here doesn't affect auth.
  }
  // NOTE: `expand()` is deliberately NOT called here any more. Part 08 §15 makes
  // launch sizing a fullscreen request with `expand()` as its pre-8.0 fallback,
  // owned by `useTelegramFullscreen`. Calling expand() here too would fire it on
  // every client, including the 8.0+ ones that are about to go fullscreen.

  return webApp.initData && webApp.initData.length > 0 ? webApp.initData : null;
}
