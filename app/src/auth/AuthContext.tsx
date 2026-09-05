import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, type AuthResult, type UserDto } from '../api/client';
import { getTelegramInitData } from './telegram-webapp';
import { isOffline } from '../net/offline';
import type { Lang } from '../i18n';
import { sessionStorage } from './session-storage';

/**
 * Auth states (§8.8):
 * - loading:      restoring a saved session or attempting Mini App auto-login.
 * - signedIn:     we have a valid first-party session.
 * - needsTelegram: not running inside Telegram (opened directly in a browser) —
 *                  show the "open from the bot" message, not a broken login.
 * - error:        we ARE in Telegram but the sign-in call failed (network / server
 *                  rejected the initData) — offer a retry.
 */
type Status = 'loading' | 'signedIn' | 'needsTelegram' | 'error';

interface AuthState {
  status: Status;
  user: UserDto | null;
  /** The active session token — needed by signed-in screens to call the API. */
  session: string | null;
  error: string | null;
  /** Re-attempt Mini App auto-login (used by the retry button on `error`). */
  retry: () => void;
  /** DEV-ONLY: sign in via the Telegram-bypass route for local runs. */
  devLogin: (lang: Lang) => Promise<void>;
  signOut: () => Promise<void>;
  setError: (message: string | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<UserDto | null>(null);
  const [session, setSession] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  const completeSignIn = useCallback(async (result: AuthResult) => {
    await sessionStorage.set(result.session);
    if (!mounted.current) return;
    setSession(result.session);
    setUser(result.user);
    setError(null);
    setStatus('signedIn');
  }, []);

  // Restore a saved session if possible; otherwise auto-login from Telegram's
  // Mini App context. No user interaction — the point is zero-friction sign-in.
  const bootstrap = useCallback(async () => {
    setStatus('loading');
    setError(null);

    const token = await sessionStorage.get();
    if (token) {
      try {
        const me = await api.me(token);
        if (!mounted.current) return;
        setUser(me);
        setSession(token);
        setStatus('signedIn');
        return;
      } catch {
        // Stale/invalid token — clear it and fall through to a fresh Mini App login.
        await sessionStorage.clear();
      }
    }

    const initData = await getTelegramInitData();
    if (!mounted.current) return;
    if (!initData) {
      // Not inside Telegram (opened directly in a browser). Nothing to verify.
      setStatus('needsTelegram');
      return;
    }
    try {
      const result = await api.telegramLogin(initData);
      await completeSignIn(result);
    } catch {
      if (!mounted.current) return;
      setError(isOffline() ? 'offline' : 'loginFailed');
      setStatus('error');
    }
  }, [completeSignIn]);

  useEffect(() => {
    mounted.current = true;
    void bootstrap();
    return () => {
      mounted.current = false;
    };
  }, [bootstrap]);

  const retry = useCallback(() => {
    void bootstrap();
  }, [bootstrap]);

  const devLogin = useCallback(
    async (lang: Lang) => {
      const result = await api.devLogin(lang);
      await completeSignIn(result);
    },
    [completeSignIn],
  );

  const signOut = useCallback(async () => {
    if (session) await api.signOut(session);
    await sessionStorage.clear();
    if (!mounted.current) return;
    setSession(null);
    setUser(null);
    // Re-derive the gate: back into Telegram means auto-login again; a browser
    // lands on the "open from Telegram" message.
    setStatus('needsTelegram');
  }, [session]);

  const value = useMemo<AuthState>(
    () => ({ status, user, session, error, retry, devLogin, signOut, setError }),
    [status, user, session, error, retry, devLogin, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
