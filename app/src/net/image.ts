// Photo attachment for the single input (§8.5/§8.1). Web target only in v1: opens
// the browser file picker, validates format + size (§10), and downscales through a
// canvas so the base64 payload stays small and the topic-ID model call stays cheap.

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 1280;

export type ImageError = 'too_large' | 'unsupported' | 'unreadable';

/** The topic-ID endpoint accepts these; we normalise everything to JPEG on encode. */
export interface EncodedImage {
  base64: string;
  mediaType: 'image/jpeg';
}

/**
 * Pure size/format guard (§10) — split out so it's testable without the DOM.
 * Any decodable image type is accepted (we re-encode to JPEG); the guard just
 * rejects non-images and anything over the size ceiling.
 */
export function validateImageFile(file: { type: string; size: number }): ImageError | null {
  if (!file.type.startsWith('image/')) return 'unsupported';
  if (file.size > MAX_IMAGE_BYTES) return 'too_large';
  return null;
}

async function downscaleToJpeg(file: File): Promise<EncodedImage> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no 2d context');
  ctx.drawImage(bitmap, 0, 0, width, height);
  const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1] ?? '';
  if (!base64) throw new Error('encode failed');
  return { base64, mediaType: 'image/jpeg' };
}

/**
 * Opens the file picker and resolves with the encoded image, an ImageError for a
 * bad/unreadable file, or null if the student cancels. Web-only; returns
 * 'unsupported' where the DOM is unavailable.
 */
export function pickAndEncodeImage(): Promise<EncodedImage | ImageError | null> {
  if (typeof document === 'undefined') return Promise.resolve('unsupported');
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const bad = validateImageFile(file);
      if (bad) {
        resolve(bad);
        return;
      }
      try {
        resolve(await downscaleToJpeg(file));
      } catch {
        resolve('unreadable');
      }
    };
    input.click();
  });
}
