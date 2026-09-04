import { Platform } from 'react-native';

// Telegram Login library (OIDC). Requesting `openid profile` only — no `phone`,
// no `telegram:bot_access` in v1 (§8.8). Returns a signed id_token the backend
// independently validates.
const WIDGET_SRC = 'https://telegram.org/js/telegram-widget.js?22';
const BOT_ID = process.env.EXPO_PUBLIC_TELEGRAM_BOT_ID ?? '8675332994';

declare global {
  interface Window {
    Telegram?: {
      Login?: {
        auth: (
          options: Record<string, unknown>,
          callback: (data: unknown) => void,
        ) => void;
      };
    };
  }
}

/**
 * Distinguishes the two ways Telegram login fails before we ever reach our server
 * (§8.10): `cancelled` — the student declined the confirmation box or the popup
 * was blocked, so no token came back; `unavailable` — the widget/library couldn't
 * load or isn't registered. The screen shows a different plain message for each.
 */
export class TelegramLoginError extends Error {
  constructor(public code: 'cancelled' | 'unavailable', message: string) {
    super(message);
    this.name = 'TelegramLoginError';
  }
}

function loadWidget(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Telegram?.Login?.auth) {
      resolve();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${WIDGET_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('widget failed to load')));
      return;
    }
    const script = document.createElement('script');
    script.src = WIDGET_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('widget failed to load'));
    document.head.appendChild(script);
  });
}

/**
 * Opens the Telegram login popup and resolves with the id_token.
 *
 * NOTE: this cannot complete until the app's URL is registered with BotFather's
 * Login Widget section — until then Telegram refuses to authorize. The exact
 * shape of the callback payload should be confirmed against a live login once
 * that registration exists; it's read defensively here.
 */
export async function telegramLogin(): Promise<string> {
  if (Platform.OS !== 'web') {
    throw new TelegramLoginError('unavailable', 'Telegram login is wired for the web target only in v1');
  }
  try {
    await loadWidget();
  } catch {
    throw new TelegramLoginError('unavailable', 'Telegram widget failed to load');
  }
  const login = window.Telegram?.Login;
  if (!login?.auth) throw new TelegramLoginError('unavailable', 'Telegram login library unavailable');

  return new Promise<string>((resolve, reject) => {
    login.auth({ bot_id: BOT_ID, request_access: false, scope: 'openid profile' }, (data) => {
      const payload = data as { id_token?: string } | null;
      if (payload?.id_token) resolve(payload.id_token);
      else reject(new TelegramLoginError('cancelled', 'login cancelled or no id_token returned'));
    });
  });
}
