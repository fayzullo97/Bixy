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

function loadSdk(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Telegram?.WebApp) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Telegram SDK failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Telegram SDK failed to load'));
    document.head.appendChild(script);
  });
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
