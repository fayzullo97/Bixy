import { describe, expect, it } from 'vitest';
import {
  contentPadding,
  decideLaunchAction,
  failureReason,
  isUnsupportedFailure,
  normalizeInset,
  ZERO_INSET,
  type FullscreenCapableWebApp,
} from './fullscreen';

const modern = (over: Partial<FullscreenCapableWebApp> = {}): FullscreenCapableWebApp => ({
  isVersionAtLeast: (v) => parseFloat(v) <= 8.0,
  requestFullscreen: () => {},
  exitFullscreen: () => {},
  expand: () => {},
  ...over,
});

describe('decideLaunchAction', () => {
  it('asks for fullscreen on an 8.0+ client that has the method', () => {
    expect(decideLaunchAction(modern())).toBe('fullscreen');
  });

  it('falls back to expand on a pre-8.0 client', () => {
    const old: FullscreenCapableWebApp = {
      isVersionAtLeast: (v) => parseFloat(v) <= 7.0,
      expand: () => {},
    };
    expect(decideLaunchAction(old)).toBe('expand');
  });

  it('falls back to expand when isVersionAtLeast is missing entirely', () => {
    expect(decideLaunchAction({ expand: () => {} })).toBe('expand');
  });

  it('falls back to expand when the version says yes but the method is absent', () => {
    expect(decideLaunchAction(modern({ requestFullscreen: undefined }))).toBe('expand');
  });

  it('reports none when neither call is available', () => {
    expect(decideLaunchAction({})).toBe('none');
    expect(decideLaunchAction(null)).toBe('none');
    expect(decideLaunchAction(undefined)).toBe('none');
  });
});

describe('normalizeInset', () => {
  it('fills in missing edges with zero', () => {
    expect(normalizeInset({ top: 12 })).toEqual({ top: 12, bottom: 0, left: 0, right: 0 });
  });

  it('treats absent, negative and non-finite values as zero', () => {
    expect(normalizeInset(null)).toEqual(ZERO_INSET);
    expect(normalizeInset({ top: -8, bottom: NaN, left: Infinity })).toEqual(ZERO_INSET);
  });
});

describe('contentPadding', () => {
  it('sums the device and content insets while fullscreen', () => {
    const padding = contentPadding(true, { top: 20, bottom: 10 }, { top: 36, bottom: 0 });
    expect(padding).toEqual({ top: 56, bottom: 10, left: 0, right: 0 });
  });

  it('is zero when not fullscreen, so Telegram’s own chrome isn’t double-counted', () => {
    expect(contentPadding(false, { top: 20 }, { top: 36 })).toEqual(ZERO_INSET);
  });

  it('survives a client that reports neither inset', () => {
    expect(contentPadding(true, undefined, undefined)).toEqual(ZERO_INSET);
  });
});

describe('failureReason / isUnsupportedFailure', () => {
  it('reads Telegram’s documented error payload', () => {
    expect(failureReason({ error: 'UNSUPPORTED' })).toBe('UNSUPPORTED');
    expect(failureReason({ error: 'ALREADY_FULLSCREEN' })).toBe('ALREADY_FULLSCREEN');
  });

  it('never assumes the payload shape', () => {
    expect(failureReason(undefined)).toBe('UNKNOWN');
    expect(failureReason('boom')).toBe('UNKNOWN');
    expect(failureReason({})).toBe('UNKNOWN');
  });

  it('does not treat ALREADY_FULLSCREEN as something to fall back from', () => {
    expect(isUnsupportedFailure({ error: 'ALREADY_FULLSCREEN' })).toBe(false);
    expect(isUnsupportedFailure({ error: 'UNSUPPORTED' })).toBe(true);
    expect(isUnsupportedFailure(undefined)).toBe(true);
  });
});

describe('FULLSCREEN_EVENT_TIMEOUT_MS', () => {
  it('is long enough to let a real client answer, short enough not to strand launch', async () => {
    const { FULLSCREEN_EVENT_TIMEOUT_MS } = await import('./fullscreen');
    expect(FULLSCREEN_EVENT_TIMEOUT_MS).toBeGreaterThanOrEqual(500);
    expect(FULLSCREEN_EVENT_TIMEOUT_MS).toBeLessThanOrEqual(3000);
  });
});
