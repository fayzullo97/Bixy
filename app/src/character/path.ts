/**
 * SVG path geometry for Bixy's morph (Part 06 §10).
 *
 * Angry-Morph is a genuine point-by-point transform of ONE set of paths, never
 * two images crossfading — so every operation here preserves structure: paths
 * are normalized to a canonical absolute command sequence, and two paths can
 * only be interpolated when those sequences match exactly. A mismatch is an
 * error rather than a best-effort blend, because a silent partial morph looks
 * like a rendering bug and would be debugged as one.
 */

export type Command =
  | { type: 'M'; values: [number, number] }
  | { type: 'L'; values: [number, number] }
  | { type: 'C'; values: [number, number, number, number, number, number] }
  | { type: 'Z'; values: [] };

export type Point = { x: number; y: number };

const NUMBER = /[+-]?(?:\d*\.\d+|\d+\.?)(?:[eE][+-]?\d+)?/g;

function numbers(chunk: string): number[] {
  return (chunk.match(NUMBER) ?? []).map(Number);
}

/**
 * Parse a path into absolute M/L/C/Z commands.
 *
 * Everything is normalized on the way in — relative commands are resolved,
 * H/V become L, Q becomes its equivalent C, and S/T are expanded using the
 * reflected control point. Two source files can then be compared and
 * interpolated on equal terms even if their exporters wrote them differently,
 * which is exactly the situation with two separately-exported assets.
 *
 * Arcs are rejected: an arc's parameters are radii and flags, not points, so
 * lerping them is not the geometric transform this morph claims to be.
 */
export function parsePath(d: string): Command[] {
  const out: Command[] = [];
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g) ?? [];

  let current: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  // Last cubic/quadratic control point, for S/T reflection.
  let lastCubicControl: Point | null = null;
  let lastQuadControl: Point | null = null;

  const push = (command: Command) => {
    out.push(command);
  };

  for (const token of tokens) {
    const type = token[0]!;
    const relative = type === type.toLowerCase() && type !== 'Z' && type !== 'z';
    const args = numbers(token.slice(1));
    const upper = type.toUpperCase();

    if (upper === 'Z') {
      push({ type: 'Z', values: [] });
      current = { ...start };
      lastCubicControl = null;
      lastQuadControl = null;
      continue;
    }

    if (upper === 'A') {
      throw new Error('parsePath: arcs (A) cannot be morphed point-by-point');
    }

    const size = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2 }[upper];
    if (!size) throw new Error(`parsePath: unsupported command "${type}"`);
    if (args.length === 0 || args.length % size !== 0) {
      throw new Error(`parsePath: "${type}" expects groups of ${size} numbers`);
    }

    for (let i = 0; i < args.length; i += size) {
      const group = args.slice(i, i + size);
      const dx = relative ? current.x : 0;
      const dy = relative ? current.y : 0;

      if (upper === 'M' || upper === 'L') {
        const point = { x: group[0]! + dx, y: group[1]! + dy };
        // Per the SVG spec, extra pairs after an M are implicit L commands.
        const asMove = upper === 'M' && i === 0;
        push({ type: asMove ? 'M' : 'L', values: [point.x, point.y] });
        current = point;
        if (asMove) start = point;
        lastCubicControl = null;
        lastQuadControl = null;
        continue;
      }

      if (upper === 'H' || upper === 'V') {
        const point =
          upper === 'H' ? { x: group[0]! + dx, y: current.y } : { x: current.x, y: group[0]! + dy };
        push({ type: 'L', values: [point.x, point.y] });
        current = point;
        lastCubicControl = null;
        lastQuadControl = null;
        continue;
      }

      if (upper === 'C' || upper === 'S') {
        const c1 =
          upper === 'C'
            ? { x: group[0]! + dx, y: group[1]! + dy }
            : reflect(lastCubicControl, current);
        const rest = upper === 'C' ? group.slice(2) : group;
        const c2 = { x: rest[0]! + dx, y: rest[1]! + dy };
        const end = { x: rest[2]! + dx, y: rest[3]! + dy };
        push({ type: 'C', values: [c1.x, c1.y, c2.x, c2.y, end.x, end.y] });
        current = end;
        lastCubicControl = c2;
        lastQuadControl = null;
        continue;
      }

      // Q/T — expressed as the equivalent cubic so everything downstream sees
      // one curve type and the structure comparison stays meaningful.
      const q: Point =
        upper === 'Q' ? { x: group[0]! + dx, y: group[1]! + dy } : reflect(lastQuadControl, current);
      const qEnd =
        upper === 'Q'
          ? { x: group[2]! + dx, y: group[3]! + dy }
          : { x: group[0]! + dx, y: group[1]! + dy };
      const c1 = { x: current.x + (2 / 3) * (q.x - current.x), y: current.y + (2 / 3) * (q.y - current.y) };
      const c2 = { x: qEnd.x + (2 / 3) * (q.x - qEnd.x), y: qEnd.y + (2 / 3) * (q.y - qEnd.y) };
      push({ type: 'C', values: [c1.x, c1.y, c2.x, c2.y, qEnd.x, qEnd.y] });
      current = qEnd;
      lastQuadControl = q;
      lastCubicControl = null;
    }
  }

  return out;
}

/** The reflection of the previous control point; the current point if there is none. */
function reflect(control: Point | null, current: Point): Point {
  if (!control) return { ...current };
  return { x: 2 * current.x - control.x, y: 2 * current.y - control.y };
}

function round(value: number): number {
  // Three decimals is well under a pixel at this character's scale and keeps the
  // `d` attribute short enough to rewrite every frame without churn.
  return Math.round(value * 1000) / 1000;
}

export function serializePath(commands: Command[]): string {
  return commands
    .map((c) => (c.type === 'Z' ? 'Z' : `${c.type}${c.values.map(round).join(' ')}`))
    .join(' ');
}

/** The command sequence, ignoring coordinates — the morph-compatibility key. */
export function pathStructure(commands: Command[]): string {
  return commands.map((c) => c.type).join('');
}

/** Whether two paths can be morphed point-by-point. */
export function morphCompatible(a: Command[], b: Command[]): boolean {
  return pathStructure(a) === pathStructure(b);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Interpolate two structurally identical paths.
 *
 * Throws on a mismatch: the spec's claim is that the calm and angry pairs share
 * identical command/point structure, so a mismatch means an asset changed, and
 * that should surface as an error at the point of breakage rather than as a
 * character that morphs oddly in one state.
 */
export function interpolatePath(a: Command[], b: Command[], t: number): Command[] {
  if (!morphCompatible(a, b)) {
    throw new Error(
      `interpolatePath: incompatible structures "${pathStructure(a)}" vs "${pathStructure(b)}"`,
    );
  }
  const clamped = Math.max(0, Math.min(1, t));
  return a.map((command, i) => {
    const other = b[i]!;
    return {
      type: command.type,
      values: command.values.map((v, j) => lerp(v, other.values[j]!, clamped)),
    } as Command;
  });
}

/**
 * Split one cubic at `t` into two cubics covering the same curve exactly
 * (de Casteljau). Used to give a one-segment eye the two-segment structure the
 * angry eye has, so the two can morph point-by-point without redrawing the art.
 */
export function subdivideCubic(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): { first: [Point, Point, Point, Point]; second: [Point, Point, Point, Point] } {
  const mid = (a: Point, b: Point): Point => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });
  const p01 = mid(p0, p1);
  const p12 = mid(p1, p2);
  const p23 = mid(p2, p3);
  const p012 = mid(p01, p12);
  const p123 = mid(p12, p23);
  const split = mid(p012, p123);
  return {
    first: [p0, p01, p012, split],
    second: [split, p123, p23, p3],
  };
}

/**
 * Split every curve of a single-segment path in half, doubling its segment
 * count while drawing exactly the same shape. A straight `L` is expressed as
 * the cubic along it first, so a dead-straight eye subdivides the same way a
 * curved one does — the resting eye is a straight line, and it still has to
 * match the angry eye's structure.
 */
export function subdividePath(commands: Command[]): Command[] {
  const out: Command[] = [];
  let current: Point = { x: 0, y: 0 };

  for (const command of commands) {
    if (command.type === 'M') {
      current = { x: command.values[0], y: command.values[1] };
      out.push(command);
      continue;
    }
    if (command.type === 'Z') {
      out.push(command);
      continue;
    }

    const end: Point =
      command.type === 'L'
        ? { x: command.values[0], y: command.values[1] }
        : { x: command.values[4], y: command.values[5] };
    const c1: Point =
      command.type === 'L'
        ? { x: lerp(current.x, end.x, 1 / 3), y: lerp(current.y, end.y, 1 / 3) }
        : { x: command.values[0], y: command.values[1] };
    const c2: Point =
      command.type === 'L'
        ? { x: lerp(current.x, end.x, 2 / 3), y: lerp(current.y, end.y, 2 / 3) }
        : { x: command.values[2], y: command.values[3] };

    const { first, second } = subdivideCubic(current, c1, c2, end, 0.5);
    out.push({ type: 'C', values: [first[1].x, first[1].y, first[2].x, first[2].y, first[3].x, first[3].y] });
    out.push({ type: 'C', values: [second[1].x, second[1].y, second[2].x, second[2].y, second[3].x, second[3].y] });
    current = end;
  }

  return out;
}

/** Point on a cubic at `t` — used to check a subdivision against the original. */
export function cubicPointAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  };
}

/**
 * Shift a whole path by a fixed offset.
 *
 * The two source assets differ in canvas size (241×191 calm vs 245×193 angry),
 * so calm coordinates are shifted +2,+1 onto the angry canvas BEFORE any
 * interpolation — otherwise the whole character drifts as anger rises (§10).
 */
export function translatePath(commands: Command[], dx: number, dy: number): Command[] {
  return commands.map((command) => {
    if (command.type === 'Z') return command;
    return {
      type: command.type,
      values: command.values.map((v, i) => (i % 2 === 0 ? v + dx : v + dy)),
    } as Command;
  });
}

/** The offset that puts calm-canvas coordinates onto the angry canvas (§10). */
export const CALM_TO_ANGRY_OFFSET = { dx: 2, dy: 1 };

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean.split('').map((c) => c + c).join('')
      : clean;
  // Length alone isn't enough — "purple" is six characters and would parse as NaN.
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`lerpColor: expected a hex color, got "${hex}"`);
  }
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Blend two hex colors — the body and sparkle fills move purple→red with anger. */
export function lerpColor(from: string, to: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const a = hexToRgb(from);
  const b = hexToRgb(to);
  const channel = (i: number) => Math.round(lerp(a[i]!, b[i]!, clamped)).toString(16).padStart(2, '0');
  return `#${channel(0)}${channel(1)}${channel(2)}`;
}
