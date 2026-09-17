import { Platform } from 'react-native';
import { canJump, readLastJump } from './jump';

const KEY = 'wt.bixy.lastJump';

// The Jump throttle has to survive a reload (Part 06 §10), so it persists the
// same way the session does: localStorage on the web build, an in-memory
// fallback elsewhere, one interface for both. See auth/session-storage.ts.
let memoryLastJump: number | null = null;

function webStorage(): Storage | null {
  return Platform.OS === 'web' && typeof localStorage !== 'undefined' ? localStorage : null;
}

export const jumpStorage = {
  get(): number | null {
    const web = webStorage();
    if (!web) return memoryLastJump;
    try {
      return readLastJump(web.getItem(KEY));
    } catch {
      return null; // storage can throw (private mode); an extra jump is harmless
    }
  },
  set(now: number): void {
    const web = webStorage();
    if (!web) {
      memoryLastJump = now;
      return;
    }
    try {
      web.setItem(KEY, String(now));
    } catch {
      memoryLastJump = now;
    }
  },
};

/** Ask for the opening jump: true at most once an hour, and it records the play. */
export function requestJump(now: number): boolean {
  if (!canJump(jumpStorage.get(), now)) return false;
  jumpStorage.set(now);
  return true;
}
