import type { FailureKind } from '../net/offline';

/**
 * How many times a stuck generation reloads automatically before we stop and tell
 * the student plainly (§8.10). Two silent attempts cover a one-off slow response;
 * beyond that it's more likely a real outage than a fluke, so looping silently
 * would just hide it.
 */
export const MAX_AUTO_RELOADS = 2;

export type GenMessageKey =
  | 'offline'
  | 'lessonTimeoutRetrying'
  | 'lessonTimeoutFailed'
  | 'lessonFailed'
  | 'noContent';

export interface GenFailurePlan {
  /** Silently re-attempt generation now — a capped automatic reload. */
  autoReload: boolean;
  /** Offer a manual "Try again" control alongside the message. */
  showManualRetry: boolean;
  messageKey: GenMessageKey;
}

/**
 * Decides what to do when a lesson generation fails (§8.10), given how many
 * automatic reloads have already been spent on this topic:
 *  - a model **timeout** auto-reloads up to the cap, then stops with a plain
 *    message and a manual retry;
 *  - a genuine **generation** failure (schema miss / 500) never auto-loops —
 *    automatic fallback risks quietly serving degraded content — so it asks the
 *    student to retry manually;
 *  - an **offline** student is told plainly, with no retry (reconnect + reload);
 *  - **no_content** (off-topic) is a plain message with a manual retry.
 */
export function planGenFailure(kind: FailureKind, autoReloadsUsed: number): GenFailurePlan {
  if (kind === 'offline') {
    return { autoReload: false, showManualRetry: false, messageKey: 'offline' };
  }
  if (kind === 'timeout') {
    if (autoReloadsUsed < MAX_AUTO_RELOADS) {
      return { autoReload: true, showManualRetry: false, messageKey: 'lessonTimeoutRetrying' };
    }
    return { autoReload: false, showManualRetry: true, messageKey: 'lessonTimeoutFailed' };
  }
  if (kind === 'no_content') {
    return { autoReload: false, showManualRetry: true, messageKey: 'noContent' };
  }
  return { autoReload: false, showManualRetry: true, messageKey: 'lessonFailed' };
}
