import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyFailure, isOffline } from './offline';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('classifyFailure', () => {
  it('reports offline first, regardless of the underlying error', () => {
    expect(classifyFailure(new Error('timeout'), false)).toBe('offline');
    expect(classifyFailure(new Error('lesson failed: 500'), false)).toBe('offline');
  });

  it('maps an aborted request (our timeout) to timeout', () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    expect(classifyFailure(abort, true)).toBe('timeout');
    expect(classifyFailure(new Error('timeout'), true)).toBe('timeout');
  });

  it('maps the typed no_content error to no_content', () => {
    expect(classifyFailure(new Error('no_content'), true)).toBe('no_content');
  });

  it('treats anything else while online as a generation failure', () => {
    expect(classifyFailure(new Error('lesson failed: 500'), true)).toBe('generation');
    expect(classifyFailure(new TypeError('Failed to fetch'), true)).toBe('generation');
  });
});

describe('isOffline', () => {
  it('assumes online when navigator is unavailable', () => {
    expect(isOffline()).toBe(false);
  });

  it('reflects navigator.onLine when present', () => {
    vi.stubGlobal('navigator', { onLine: false });
    expect(isOffline()).toBe(true);
    vi.stubGlobal('navigator', { onLine: true });
    expect(isOffline()).toBe(false);
  });
});
