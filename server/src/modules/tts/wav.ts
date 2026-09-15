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

/** WAV PCM format descriptor, read off a real clip so silence can match it. */
export interface WavFormat {
  sampleRate: number;
  channels: number;
  bits: number;
}

/**
 * Splits narration into sentences for per-clip synthesis (Part 02 §3).
 *
 * Deliberately does NOT merge short sentences into their neighbours: a filler
 * interjection ("Hmm...", "Xo'p, mayli.") is its own sentence, and the 400ms gap
 * that follows it IS the thinking pause the section is asking for. Merging would
 * synthesize it as one continuous breath and lose the effect.
 *
 * Distinct from `chunkByChars`, which merges UP TO a provider's character cap —
 * the opposite goal. Provider caps still apply underneath: a single sentence
 * longer than the cap is chunked again by the client that sends it.
 */
export function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const matches = trimmed.match(/[^.!?…]+[.!?…]*\s*/gu);
  const sentences = (matches ?? [trimmed]).map((s) => s.trim()).filter(Boolean);
  return sentences.length > 0 ? sentences : [trimmed];
}

/** Reads a clip's PCM format, so generated silence matches it exactly. */
export function readWavFormat(buffer: Buffer): WavFormat {
  const fmtIdx = buffer.indexOf('fmt ', 12, 'ascii');
  if (fmtIdx < 0) throw new Error('WAV: no fmt chunk');
  return {
    channels: buffer.readUInt16LE(fmtIdx + 10),
    sampleRate: buffer.readUInt32LE(fmtIdx + 12),
    bits: buffer.readUInt16LE(fmtIdx + 22),
  };
}

/** How long a WAV's PCM data runs, in milliseconds. */
export function wavDurationMs(buffer: Buffer): number {
  const { sampleRate, channels, bits } = readWavFormat(buffer);
  const dataIdx = buffer.indexOf('data', 12, 'ascii');
  if (dataIdx < 0) return 0;
  const bytes = Math.min(buffer.readUInt32LE(dataIdx + 4), buffer.length - (dataIdx + 8));
  const bytesPerSecond = sampleRate * channels * (bits / 8);
  return bytesPerSecond > 0 ? Math.round((bytes / bytesPerSecond) * 1000) : 0;
}

/** A silent WAV of `ms` in the given format — the 400ms gap between sentences. */
export function silenceWav(ms: number, format: WavFormat): Buffer {
  const { sampleRate, channels, bits } = format;
  const bytes = Math.round((ms / 1000) * sampleRate * channels * (bits / 8));
  // Align to a whole frame so the splice never lands mid-sample.
  const frame = channels * (bits / 8);
  const data = Buffer.alloc(Math.ceil(bytes / frame) * frame);

  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE((sampleRate * channels * bits) / 8, 28);
  header.writeUInt16LE(frame, 32);
  header.writeUInt16LE(bits, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

/** Chunk size a streaming WAV writes when the total length isn't known yet. */
const STREAMING_SIZE = 0xffffffff;

/**
 * Rewrites a streamed WAV's placeholder chunk sizes with the real byte counts.
 *
 * OpenAI's /v1/audio/speech returns `response_format: "wav"` with both the RIFF
 * size and the `data` chunk size set to 0xFFFFFFFF — correct for a stream whose
 * length isn't known as it's produced, but wrong for a file we store in the
 * bucket and serve by URL: isPlausibleWav rejects it, and players disagree on
 * whether to treat it as "read to EOF". We hold the whole body in memory by the
 * time we get here, so the real sizes are simply known.
 *
 * Returns the buffer untouched when the sizes are already sane, so a canonical
 * WAV (Aisha's, or a rejoined one) passes straight through.
 */
export function normalizeWav(buffer: Buffer): Buffer {
  if (buffer.length < 44) return buffer;
  if (buffer.toString('ascii', 0, 4) !== 'RIFF') return buffer;
  if (buffer.toString('ascii', 8, 12) !== 'WAVE') return buffer;
  const dataIdx = buffer.indexOf('data', 12, 'ascii');
  if (dataIdx < 0) return buffer;

  const declared = buffer.readUInt32LE(dataIdx + 4);
  const actual = buffer.length - (dataIdx + 8);
  // A declared size that fits is either exact or has trailing chunks after the
  // data — either way it's a real length, so leave it alone.
  if (declared !== STREAMING_SIZE && declared <= actual) return buffer;

  const out = Buffer.from(buffer);
  out.writeUInt32LE(buffer.length - 8, 4);
  out.writeUInt32LE(actual, dataIdx + 4);
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
