import { useCallback, useEffect, useRef, useState } from 'react';
import { ensureTelegramWebApp } from '../auth/telegram-webapp';
import {
  FULLSCREEN_EVENTS,
  FULLSCREEN_EVENT_TIMEOUT_MS,
  contentPadding,
  decideLaunchAction,
  isUnsupportedFailure,
  ZERO_INSET,
  type FullscreenCapableWebApp,
  type Inset,
} from './fullscreen';

export interface FullscreenState {
  /** True once Telegram has CONFIRMED fullscreen via `fullscreenChanged` (§15). */
  isFullscreen: boolean;
  /** Whether an exit control should be offered — i.e. we can actually exit. */
  canExit: boolean;
  /** Padding content must clear so it doesn't collide with window chrome (§15). */
  insets: Inset;
  /** Manual exit (§15: "student can minimize it later"). */
  exit: () => void;
}

/**
 * Requests Telegram Desktop fullscreen on launch and tracks what actually
 * happened (Part 08 §15).
 *
 * The request is never assumed to have worked. `isFullscreen` flips only when
 * Telegram fires `fullscreenChanged`, and `fullscreenFailed` falls back to
 * `expand()` — so a client that reports 8.0 but refuses the request still ends
 * up expanded rather than sitting in a half-applied state, offering an exit
 * control for a fullscreen it never entered.
 *
 * The WebApp object is awaited rather than read synchronously: the SDK `<script>`
 * is injected at runtime, so on first mount `window.Telegram` usually isn't there
 * yet and a synchronous read would make this hook a silent no-op.
 */
export function useTelegramFullscreen(): FullscreenState {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [canExit, setCanExit] = useState(false);
  const [safeArea, setSafeArea] = useState<Partial<Inset> | null>(null);
  const [contentSafeArea, setContentSafeArea] = useState<Partial<Inset> | null>(null);
  const appRef = useRef<FullscreenCapableWebApp | null>(null);

  useEffect(() => {
    let cancelled = false;
    let detach: (() => void) | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      const app = (await ensureTelegramWebApp()) as FullscreenCapableWebApp | null;
      // A late resolve after unmount must not subscribe or touch state.
      if (cancelled || !app) return;
      appRef.current = app;

      const readInsets = () => {
        setSafeArea(app.safeAreaInset ?? null);
        setContentSafeArea(app.contentSafeAreaInset ?? null);
      };

      // Either event means the client answered; the watchdog is no longer needed.
      const answered = () => {
        if (watchdog !== undefined) {
          clearTimeout(watchdog);
          watchdog = undefined;
        }
      };

      const onChanged = () => {
        answered();
        const on = app.isFullscreen === true;
        setIsFullscreen(on);
        setCanExit(on && typeof app.exitFullscreen === 'function');
        readInsets();
      };

      const onFailed = (payload?: unknown) => {
        answered();
        setIsFullscreen(false);
        setCanExit(false);
        // ALREADY_FULLSCREEN isn't a failure to recover from — expanding on top
        // of it would be a pointless second chrome call.
        if (isUnsupportedFailure(payload)) {
          try {
            app.expand?.();
          } catch {
            // Best-effort chrome; a refusal here must not break launch.
          }
        }
      };

      app.onEvent?.(FULLSCREEN_EVENTS.changed, onChanged);
      app.onEvent?.(FULLSCREEN_EVENTS.failed, onFailed);
      app.onEvent?.(FULLSCREEN_EVENTS.safeArea, readInsets);
      app.onEvent?.(FULLSCREEN_EVENTS.contentSafeArea, readInsets);
      detach = () => {
        answered();
        app.offEvent?.(FULLSCREEN_EVENTS.changed, onChanged);
        app.offEvent?.(FULLSCREEN_EVENTS.failed, onFailed);
        app.offEvent?.(FULLSCREEN_EVENTS.safeArea, readInsets);
        app.offEvent?.(FULLSCREEN_EVENTS.contentSafeArea, readInsets);
      };

      // A client can already be fullscreen when we mount (a reload inside a
      // fullscreen session), in which case no `fullscreenChanged` is coming.
      if (app.isFullscreen === true) onChanged();
      else readInsets();

      try {
        const action = decideLaunchAction(app);
        if (action === 'fullscreen') {
          app.requestFullscreen?.();
          // See FULLSCREEN_EVENT_TIMEOUT_MS: a client that answers with neither
          // event would otherwise leave the app at its default size.
          watchdog = setTimeout(() => {
            watchdog = undefined;
            try {
              app.expand?.();
            } catch {
              // Best-effort chrome.
            }
          }, FULLSCREEN_EVENT_TIMEOUT_MS);
        } else if (action === 'expand') {
          app.expand?.();
        }
      } catch {
        // A throwing chrome call must not take the app down with it.
      }
    })();

    return () => {
      cancelled = true;
      detach?.();
    };
  }, []);

  const exit = useCallback(() => {
    try {
      appRef.current?.exitFullscreen?.();
    } catch {
      // Telegram still owns the state; a refusal leaves us fullscreen, and the
      // next `fullscreenChanged` (if any) corrects our mirror of it.
    }
  }, []);

  return {
    isFullscreen,
    canExit,
    insets: isFullscreen ? contentPadding(true, safeArea, contentSafeArea) : ZERO_INSET,
    exit,
  };
}
