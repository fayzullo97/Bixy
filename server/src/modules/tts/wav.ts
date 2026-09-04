/** How a limit is measured against a piece of text. */
type Measure = (text: string) => number;
const charLen: Measure = (text) => text.length;

/**
 * Splits text into pieces each within `maxChars` characters, preferring sentence
 * boundaries, then word boundaries, then (last resort) a hard cut between
 * characters. Aisha caps a request at 1000 characters (§9.1) — note it counts
 * characters, not UTF-8 bytes, so Cyrillic gets the full budget rather than half.
 */
export function chunkByChars(text: string, maxChars: number): string[] {
  return chunkText(text, maxChars, charLen);
}

function chunkText(text: string, max: number, measure: Measure): string[] {
  const trimmed = text.trim();
  if (measure(trimmed) <= max) return [trimmed];

  const sentences = trimmed.match(/[^.!?…]+[.!?…]*\s*/gu) ?? [trimmed];
  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    if (current.trim()) chunks.push(current.trim());
    current = '';
  };

  for (const sentence of sentences) {
    if (measure(sentence) > max) {
      flush();
      chunks.push(...splitUnit(sentence, max, /\s+/u, measure));
      continue;
    }
    if (measure(current + sentence) > max) flush();
    current += sentence;
  }
  flush();
  return chunks;
}

/** Splits an over-long unit on `separator`, hard-slicing any piece still too big. */
function splitUnit(text: string, max: number, separator: RegExp, measure: Measure): string[] {
  const parts = text.split(separator).filter(Boolean);
  const out: string[] = [];
  let current = '';
  for (const part of parts) {
    if (measure(part) > max) {
      if (current) out.push(current.trim());
      current = '';
      out.push(...hardSlice(part, max, measure));
      continue;
    }
    const candidate = current ? `${current} ${part}` : part;
    if (measure(candidate) > max) {
      out.push(current.trim());
      current = part;
    } else {
      current = candidate;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** Codepoint-safe hard slice (never splits a multi-codeunit character). */
function hardSlice(text: string, max: number, measure: Measure): string[] {
  const out: string[] = [];
  let current = '';
  for (const char of text) {
    if (measure(current + char) > max) {
      out.push(current);
      current = '';
    }
    current += char;
  }
  if (current) out.push(current);
  return out;
}

/**
 * Cheap "is this actually audio?" check. A 201 from Aisha then a 200 from the CDN
 * only proves bytes came back — not that they're a usable WAV. This catches an
 * HTML error page, an empty body, or a zero-length data chunk served under a 200,
 * so the caller retries instead of storing silence (§8.10 — a status code is not
 * proof of a reasonable response). A usable narration is a canonical RIFF/WAVE
 * container with a non-empty PCM data chunk that fits in the buffer.
 */
export function isPlausibleWav(buffer: Buffer): boolean {
  if (buffer.length < 44) return false;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return false;
  if (buffer.toString('ascii', 8, 12) !== 'WAVE') return false;
  const dataIdx = buffer.indexOf('data', 12, 'ascii');
  if (dataIdx < 0) return false;
  const dataLen = buffer.readUInt32LE(dataIdx + 4);
  return dataLen > 0 && dataIdx + 8 + dataLen <= buffer.length;
}

/** Reads the little-endian PCM data chunk out of a canonical WAV buffer. */
function readWavData(buffer: Buffer): { data: Buffer; sampleRate: number; channels: number; bits: number } {
  const dataIdx = buffer.indexOf('data', 12, 'ascii');
  if (dataIdx < 0) throw new Error('WAV: no data chunk');
  const dataLen = buffer.readUInt32LE(dataIdx + 4);
  const data = buffer.subarray(dataIdx + 8, dataIdx + 8 + dataLen);
  const fmtIdx = buffer.indexOf('fmt ', 12, 'ascii');
  const channels = fmtIdx >= 0 ? buffer.readUInt16LE(fmtIdx + 10) : 1;
  const sampleRate = fmtIdx >= 0 ? buffer.readUInt32LE(fmtIdx + 12) : 24000;
  const bits = fmtIdx >= 0 ? buffer.readUInt16LE(fmtIdx + 22) : 16;
  return { data, sampleRate, channels, bits };
}

/** Concatenates same-format WAV buffers into one (used to rejoin chunked narration). */
export function concatWav(buffers: Buffer[]): Buffer {
  if (buffers.length === 1) return buffers[0]!;
  const parsed = buffers.map(readWavData);
  const { sampleRate, channels, bits } = parsed[0]!;
  const pcm = Buffer.concat(parsed.map((p) => p.data));

  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE((sampleRate * channels * bits) / 8, 28);
  header.writeUInt16LE((channels * bits) / 8, 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}
