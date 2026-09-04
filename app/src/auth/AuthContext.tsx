import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, type AuthResult, type UserDto } from '../api/client';
import { sessionStorage } from './session-storage';

type Status = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: Status;
  user: UserDto | null;
  /** The active session token — needed by signed-in screens to call the API. */
  session: string | null;
  error: string | null;
  completeSignIn: (result: AuthResult) => Promise<void>;
  signOut: () => Promise<void>;
  setError: (message: string | null) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<UserDto | null>(null);
  const [session, setSession] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // On load, restore a persisted session by validating it against /me (§8.8).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await sessionStorage.get();
      if (!token) {
        if (!cancelled) setStatus('signedOut');
        return;
      }
      try {
        const me = await api.me(token);
        if (cancelled) return;
        setUser(me);
        setSession(token);
        setStatus('signedIn');
      } catch {
        await sessionStorage.clear();
        if (!cancelled) setStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completeSignIn = async (result: AuthResult) => {
    await sessionStorage.set(result.session);
    setSession(result.session);
    setUser(result.user);
    setError(null);
    setStatus('signedIn');
  };

  const signOut = async () => {
    if (session) await api.signOut(session);
    await sessionStorage.clear();
    setSession(null);
    setUser(null);
    setStatus('signedOut');
  };

  const value = useMemo<AuthState>(
    () => ({ status, user, session, error, completeSignIn, signOut, setError }),
    // completeSignIn/signOut close over `session`, so include it in deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, user, error, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
