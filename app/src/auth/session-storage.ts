import { Platform } from 'react-native';

const KEY = 'wt.session';

// A persisted session keeps the student signed in across reloads (§8.8).
// v1 ships the web build, where localStorage survives reloads. Native builds
// (mobile phase) swap in expo-secure-store / AsyncStorage behind this same
// interface — the rest of the app doesn't change.
let memoryToken: string | null = null;

function webStorage(): Storage | null {
  return Platform.OS === 'web' && typeof localStorage !== 'undefined' ? localStorage : null;
}

export const sessionStorage = {
  async get(): Promise<string | null> {
    const web = webStorage();
    return web ? web.getItem(KEY) : memoryToken;
  },
  async set(token: string): Promise<void> {
    const web = webStorage();
    if (web) web.setItem(KEY, token);
    else memoryToken = token;
  },
  async clear(): Promise<void> {
    const web = webStorage();
    if (web) web.removeItem(KEY);
    else memoryToken = null;
  },
};
