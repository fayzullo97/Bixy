import { describe, expect, it } from 'vitest';
import { MAX_AUTO_RELOADS, planGenFailure } from './genRetry';

describe('planGenFailure (§8.10)', () => {
  it('tells an offline student plainly, with no retry', () => {
    expect(planGenFailure('offline', 0)).toEqual({
      autoReload: false,
      showManualRetry: false,
      messageKey: 'offline',
    });
  });

  it('auto-reloads a timeout up to the cap, then stops with a manual retry', () => {
    // Under the cap: silent reload, no message shown.
    expect(planGenFailure('timeout', 0).autoReload).toBe(true);
    expect(planGenFailure('timeout', MAX_AUTO_RELOADS - 1).autoReload).toBe(true);
    // At the cap: stop, tell the student, offer a manual retry.
    const stopped = planGenFailure('timeout', MAX_AUTO_RELOADS);
    expect(stopped).toEqual({
      autoReload: false,
      showManualRetry: true,
      messageKey: 'lessonTimeoutFailed',
    });
  });

  it('never auto-loops a genuine generation failure — manual retry only', () => {
    expect(planGenFailure('generation', 0)).toEqual({
      autoReload: false,
      showManualRetry: true,
      messageKey: 'lessonFailed',
    });
  });

  it('shows off-topic content plainly with a manual retry', () => {
    expect(planGenFailure('no_content', 0)).toEqual({
      autoReload: false,
      showManualRetry: true,
      messageKey: 'noContent',
    });
  });

  it('a stuck model reloads exactly MAX_AUTO_RELOADS times before giving up', () => {
    let used = 0;
    let reloads = 0;
    // Simulate repeated timeouts, incrementing the counter on each auto-reload.
    for (let i = 0; i < 10; i++) {
      const plan = planGenFailure('timeout', used);
      if (plan.autoReload) {
        used += 1;
        reloads += 1;
      } else {
        expect(plan.showManualRetry).toBe(true);
        break;
      }
    }
    expect(reloads).toBe(MAX_AUTO_RELOADS);
  });
});
