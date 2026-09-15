import { Platform } from 'react-native';
import { CALM, angerFromStreak, readAngerState, type AngerState } from './anger';

const KEY = 'wt.bixy.anger';

// Anger decays over three hours of REAL time (Part 06 §10), which is longer
// than most sessions — so the trigger has to outlive the tab. Same shape as
// auth/session-storage.ts: localStorage on web, memory elsewhere.
let memoryState: AngerState | null = null;

function webStorage(): Storage | null {
  return Platform.OS === 'web' && typeof localStorage !== 'undefined' ? localStorage : null;
}

export const angerStorage = {
  get(): AngerState | null {
    const web = webStorage();
    if (!web) return memoryState;
    try {
      return readAngerState(web.getItem(KEY));
    } catch {
      return null;
    }
  },
  set(state: AngerState): void {
    const web = webStorage();
    if (!web) {
      memoryState = state;
      return;
    }
    try {
      web.setItem(KEY, JSON.stringify(state));
    } catch {
      memoryState = state;
    }
  },
};

/**
 * The anger to show on arrival.
 *
 * A stored state wins, because it carries WHEN the anger was triggered and so
 * keeps decaying across restarts — the thing §10 asks for. The server's streak
 * is the fallback for a student whose local state is gone (a new device,
 * cleared storage): it knows they're mid-struggle but not when, so it stamps
 * now and starts the three hours over. Preferring it instead would reset the
 * decay on every app open and make the anger effectively permanent until they
 * pass.
 */
export function resolveAnger(reteachAllStreak: number, now: number): AngerState {
  const stored = angerStorage.get();
  if (stored) return stored;
  if (reteachAllStreak > 0) {
    const restored = angerFromStreak(reteachAllStreak, now);
    angerStorage.set(restored);
    return restored;
  }
  return CALM;
}
