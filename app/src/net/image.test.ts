import { describe, expect, it } from 'vitest';
import { MAX_IMAGE_BYTES, validateImageFile } from './image';

describe('validateImageFile', () => {
  it('accepts an image within the size limit', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 1_000_000 })).toBeNull();
    expect(validateImageFile({ type: 'image/png', size: 500 })).toBeNull();
  });

  it('rejects a non-image file', () => {
    expect(validateImageFile({ type: 'application/pdf', size: 100 })).toBe('unsupported');
    expect(validateImageFile({ type: 'text/plain', size: 10 })).toBe('unsupported');
  });

  it('rejects an image over the size ceiling', () => {
    expect(validateImageFile({ type: 'image/png', size: MAX_IMAGE_BYTES + 1 })).toBe('too_large');
  });
});
