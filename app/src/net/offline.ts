/** How a failed lesson/plan request is categorised for the student (§8.10). */
export type FailureKind = 'offline' | 'timeout' | 'no_content' | 'generation';

/**
 * True when the browser reports no connectivity (§8.10 — a lost connection is
 * told plainly, not silently retried). Reads `navigator.onLine`, the web signal;
 * where it's unavailable (native, tests) we conservatively assume online rather
 * than block. No react-native import so the module stays portable and testable.
 */
export function isOffline(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean') return false;
  return navigator.onLine === false;
}

/**
 * Maps a thrown error to a failure kind (§8.10). Pure: the caller passes the
 * current online state so this is testable without touching globals. An abort
 * (our request timeout) is a timeout; the typed `no_content` is off-topic; a lost
 * connection wins over everything else; anything else is a generation failure.
 */
export function classifyFailure(error: unknown, online: boolean): FailureKind {
  if (!online) return 'offline';
  const err = error as { name?: string; message?: string } | null;
  const msg = String(err?.message ?? error ?? '');
  if (err?.name === 'AbortError' || msg === 'timeout') return 'timeout';
  if (msg === 'no_content') return 'no_content';
  return 'generation';
}
