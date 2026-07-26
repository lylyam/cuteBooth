/**
 * SVG path-data primitives — helper of node C2 (`canvasUtils`).
 *
 * Pure string and number math: no DOM, no canvas, no React, no geometry of its own. It
 * exists because `Path2D` can clip with a path but cannot measure one, and C2 needs the
 * **bounding box of a frame hole** to fit a photo into a shape that is smaller than its
 * slot (see `docs/contracts/layouts.md` rule 6).
 *
 * Everything is normalised to absolute `M` / `L` / `C` / `Z`, which is enough to represent
 * every command the 24 frame files use (verified: only `M H V L C Z`, all absolute) and
 * keeps bounds, scaling and de-duplication to one code path.
 */

/** Same shape as `Rect` in `constants/frames.ts`; declared here so this file imports nothing. */
export type PathBounds = { x: number; y: number; width: number; height: number };

/** A rectangle as SVG writes it, with the `rx`/`ry` rules of `<rect>`. */
export type RectShape = {
  x: number;
  y: number;
  width: number;
  height: number;
  rx?: number | null;
  ry?: number | null;
};

export type PathSegment =
  | { type: 'M'; x: number; y: number }
  | { type: 'L'; x: number; y: number }
  | { type: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { type: 'Z' };

/** Splits `d` into `[command, arguments]` pairs. Arcs are matched so they can be rejected. */
const COMMAND_PATTERN = /([MmZzLlHhVvCcSsQqTtAa])([^MmZzLlHhVvCcSsQqTtAa]*)/g;

/** `12`, `-.5`, `1.5e-3` — and `1.5.5` as the two numbers SVG says it is. */
const NUMBER_PATTERN = /[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g;

const ARGUMENT_COUNT: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  Z: 0,
};

/** Control-point ratio that turns a cubic into a quarter ellipse, to within 0.03 % of the radius. */
const CIRCLE_KAPPA = 0.5522847498307936;

/** Decimals kept when a path is turned back into text. 3 is ~1/1000 of a viewBox unit. */
const DEFAULT_PRECISION = 3;

type Point = { x: number; y: number };

/**
 * `d` attribute → normalised absolute segments, or `null` when the path cannot be trusted:
 * an arc (`A`), a leading command other than `moveto`, a wrong argument count, a `NaN`.
 *
 * `null` is a value the caller handles, not an exception: a frame whose hole cannot be
 * measured falls back to the slot rectangle of `layouts.ts` instead of failing the draw.
 */
export function parsePathData(data: string): PathSegment[] | null {
  const source = data.trim();
  if (!source) return null;

  const segments: PathSegment[] = [];
  let current: Point = { x: 0, y: 0 };
  let subpathStart: Point = { x: 0, y: 0 };
  let lastCubicControl: Point | null = null;
  let lastQuadControl: Point | null = null;
  let first = true;

  COMMAND_PATTERN.lastIndex = 0;
  let match = COMMAND_PATTERN.exec(source);

  // Anything before the first command — or no command at all — is not path data.
  if (!match || match.index !== 0) return null;

  while (match) {
    const command = match[1];
    const type = command.toUpperCase();
    const relative = command !== type;
    const arity = ARGUMENT_COUNT[type];

    // `A` is the only command with no entry: unsupported on purpose, see the doc comment.
    if (arity === undefined) return null;
    if (first && type !== 'M') return null;

    const numbers = (match[2].match(NUMBER_PATTERN) ?? []).map(Number);
    if (numbers.some((value) => !Number.isFinite(value))) return null;

    if (arity === 0) {
      if (numbers.length !== 0) return null;
      segments.push({ type: 'Z' });
      current = { ...subpathStart };
      lastCubicControl = null;
      lastQuadControl = null;
    } else {
      if (numbers.length === 0 || numbers.length % arity !== 0) return null;

      for (let offset = 0; offset < numbers.length; offset += arity) {
        const args = numbers.slice(offset, offset + arity);
        const implicitLineto = type === 'M' && offset > 0;

        switch (type) {
          case 'M': {
            const point = absolute(args[0], args[1], current, relative);
            if (implicitLineto) {
              segments.push({ type: 'L', ...point });
            } else {
              segments.push({ type: 'M', ...point });
              subpathStart = { ...point };
            }
            current = point;
            lastCubicControl = null;
            lastQuadControl = null;
            break;
          }
          case 'L': {
            const point = absolute(args[0], args[1], current, relative);
            segments.push({ type: 'L', ...point });
            current = point;
            lastCubicControl = null;
            lastQuadControl = null;
            break;
          }
          case 'H': {
            const point = { x: relative ? current.x + args[0] : args[0], y: current.y };
            segments.push({ type: 'L', ...point });
            current = point;
            lastCubicControl = null;
            lastQuadControl = null;
            break;
          }
          case 'V': {
            const point = { x: current.x, y: relative ? current.y + args[0] : args[0] };
            segments.push({ type: 'L', ...point });
            current = point;
            lastCubicControl = null;
            lastQuadControl = null;
            break;
          }
          case 'C': {
            const control1 = absolute(args[0], args[1], current, relative);
            const control2 = absolute(args[2], args[3], current, relative);
            const point = absolute(args[4], args[5], current, relative);
            segments.push(cubic(control1, control2, point));
            current = point;
            lastCubicControl = control2;
            lastQuadControl = null;
            break;
          }
          case 'S': {
            const control1 = reflect(lastCubicControl, current);
            const control2 = absolute(args[0], args[1], current, relative);
            const point = absolute(args[2], args[3], current, relative);
            segments.push(cubic(control1, control2, point));
            current = point;
            lastCubicControl = control2;
            lastQuadControl = null;
            break;
          }
          case 'Q': {
            const control = absolute(args[0], args[1], current, relative);
            const point = absolute(args[2], args[3], current, relative);
            segments.push(quadraticAsCubic(current, control, point));
            current = point;
            lastCubicControl = null;
            lastQuadControl = control;
            break;
          }
          case 'T': {
            const control = reflect(lastQuadControl, current);
            const point = absolute(args[0], args[1], current, relative);
            segments.push(quadraticAsCubic(current, control, point));
            current = point;
            lastCubicControl = null;
            lastQuadControl = control;
            break;
          }
          default:
            return null;
        }
      }
    }

    first = false;
    match = COMMAND_PATTERN.exec(source);
  }

  return segments.length > 0 ? segments : null;
}

/**
 * Tight bounding box, curve extremes included — not the box of the control points, which
 * for a cloud-shaped hole overshoots by several units and would under-fill the photo.
 */
export function pathBounds(segments: readonly PathSegment[]): PathBounds | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let seen = false;

  const includeX = (x: number): void => {
    seen = true;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
  };
  const includeY = (y: number): void => {
    seen = true;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };
  const include = (x: number, y: number): void => {
    includeX(x);
    includeY(y);
  };

  let current: Point = { x: 0, y: 0 };
  let subpathStart: Point = { x: 0, y: 0 };

  for (const segment of segments) {
    switch (segment.type) {
      case 'M':
        include(segment.x, segment.y);
        current = { x: segment.x, y: segment.y };
        subpathStart = { ...current };
        break;
      case 'L':
        include(segment.x, segment.y);
        current = { x: segment.x, y: segment.y };
        break;
      case 'C':
        include(segment.x, segment.y);
        for (const value of cubicExtremes(current.x, segment.x1, segment.x2, segment.x)) {
          includeX(value);
        }
        for (const value of cubicExtremes(current.y, segment.y1, segment.y2, segment.y)) {
          includeY(value);
        }
        current = { x: segment.x, y: segment.y };
        break;
      case 'Z':
        current = { ...subpathStart };
        break;
    }
  }

  if (!seen) return null;
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Uniform (or per-axis) scale. Used to take a hole from viewBox units to canvas pixels. */
export function scalePathSegments(
  segments: readonly PathSegment[],
  scaleX: number,
  scaleY: number = scaleX,
): PathSegment[] {
  return segments.map((segment) => {
    switch (segment.type) {
      case 'M':
      case 'L':
        return { type: segment.type, x: segment.x * scaleX, y: segment.y * scaleY };
      case 'C':
        return {
          type: 'C',
          x1: segment.x1 * scaleX,
          y1: segment.y1 * scaleY,
          x2: segment.x2 * scaleX,
          y2: segment.y2 * scaleY,
          x: segment.x * scaleX,
          y: segment.y * scaleY,
        };
      case 'Z':
        return { type: 'Z' };
    }
  });
}

/** Translation, applied before the scale when a `viewBox` does not start at `0 0`. */
export function translatePathSegments(
  segments: readonly PathSegment[],
  dx: number,
  dy: number,
): PathSegment[] {
  if (dx === 0 && dy === 0) return segments.slice();

  return segments.map((segment) => {
    switch (segment.type) {
      case 'M':
      case 'L':
        return { type: segment.type, x: segment.x + dx, y: segment.y + dy };
      case 'C':
        return {
          type: 'C',
          x1: segment.x1 + dx,
          y1: segment.y1 + dy,
          x2: segment.x2 + dx,
          y2: segment.y2 + dy,
          x: segment.x + dx,
          y: segment.y + dy,
        };
      case 'Z':
        return { type: 'Z' };
    }
  });
}

/** Segments → `d` string, ready for `new Path2D(...)`. Also the de-duplication key. */
export function serializePathData(
  segments: readonly PathSegment[],
  precision: number = DEFAULT_PRECISION,
): string {
  const n = (value: number): string => format(value, precision);

  return segments
    .map((segment) => {
      switch (segment.type) {
        case 'M':
          return `M${n(segment.x)} ${n(segment.y)}`;
        case 'L':
          return `L${n(segment.x)} ${n(segment.y)}`;
        case 'C':
          return `C${n(segment.x1)} ${n(segment.y1)} ${n(segment.x2)} ${n(segment.y2)} ${n(segment.x)} ${n(segment.y)}`;
        case 'Z':
          return 'Z';
      }
    })
    .join('');
}

/**
 * `<rect>` → segments, with the `rx`/`ry` rules of the SVG spec: one radius given means
 * both, and each is clamped to half the side.
 *
 * Needed because a hole is not always a `<path>`: `wide/Frame 7`, `spotlight/Frame 8` and
 * `spotlight/Frame 13` draw some or all of theirs as rounded rectangles, and
 * `spotlight/Frame 18` duplicates one of them — so rects must reach the same normalise →
 * de-duplicate → measure pipeline as paths, or the duplicate slips through.
 */
export function roundedRectSegments(rect: RectShape): PathSegment[] | null {
  const { x, y, width, height } = rect;
  const valid = [x, y, width, height].every((value) => Number.isFinite(value));
  if (!valid || width <= 0 || height <= 0) return null;

  const rawX = numberOrNull(rect.rx);
  const rawY = numberOrNull(rect.ry);
  const rx = Math.min(Math.max(rawX ?? rawY ?? 0, 0), width / 2);
  const ry = Math.min(Math.max(rawY ?? rawX ?? 0, 0), height / 2);

  const right = x + width;
  const bottom = y + height;

  if (rx === 0 || ry === 0) {
    return [
      { type: 'M', x, y },
      { type: 'L', x: right, y },
      { type: 'L', x: right, y: bottom },
      { type: 'L', x, y: bottom },
      { type: 'Z' },
    ];
  }

  const cx = rx * CIRCLE_KAPPA;
  const cy = ry * CIRCLE_KAPPA;

  return [
    { type: 'M', x: x + rx, y },
    { type: 'L', x: right - rx, y },
    { type: 'C', x1: right - rx + cx, y1: y, x2: right, y2: y + ry - cy, x: right, y: y + ry },
    { type: 'L', x: right, y: bottom - ry },
    {
      type: 'C',
      x1: right,
      y1: bottom - ry + cy,
      x2: right - rx + cx,
      y2: bottom,
      x: right - rx,
      y: bottom,
    },
    { type: 'L', x: x + rx, y: bottom },
    { type: 'C', x1: x + rx - cx, y1: bottom, x2: x, y2: bottom - ry + cy, x, y: bottom - ry },
    { type: 'L', x, y: y + ry },
    { type: 'C', x1: x, y1: y + ry - cy, x2: x + rx - cx, y2: y, x: x + rx, y },
    { type: 'Z' },
  ];
}

function absolute(dx: number, dy: number, current: Point, relative: boolean): Point {
  return relative ? { x: current.x + dx, y: current.y + dy } : { x: dx, y: dy };
}

function cubic(control1: Point, control2: Point, point: Point): PathSegment {
  return {
    type: 'C',
    x1: control1.x,
    y1: control1.y,
    x2: control2.x,
    y2: control2.y,
    x: point.x,
    y: point.y,
  };
}

/** Mirror of the previous control point about the current point — the `S` and `T` rule. */
function reflect(control: Point | null, current: Point): Point {
  if (!control) return { ...current };
  return { x: 2 * current.x - control.x, y: 2 * current.y - control.y };
}

function quadraticAsCubic(from: Point, control: Point, to: Point): PathSegment {
  return cubic(
    { x: from.x + (2 / 3) * (control.x - from.x), y: from.y + (2 / 3) * (control.y - from.y) },
    { x: to.x + (2 / 3) * (control.x - to.x), y: to.y + (2 / 3) * (control.y - to.y) },
    to,
  );
}

/**
 * Values of one axis of a cubic at the roots of its derivative, i.e. wherever the curve
 * turns around inside `0 < t < 1`. Endpoints are the caller's business.
 */
function cubicExtremes(p0: number, p1: number, p2: number, p3: number): number[] {
  const a = p1 - p0;
  const b = p2 - p1;
  const c = p3 - p2;

  const qa = a - 2 * b + c;
  const qb = 2 * (b - a);
  const qc = a;

  const roots: number[] = [];

  if (Math.abs(qa) < 1e-12) {
    if (Math.abs(qb) > 1e-12) roots.push(-qc / qb);
  } else {
    const discriminant = qb * qb - 4 * qa * qc;
    if (discriminant >= 0) {
      const root = Math.sqrt(discriminant);
      roots.push((-qb + root) / (2 * qa), (-qb - root) / (2 * qa));
    }
  }

  return roots
    .filter((t) => t > 0 && t < 1)
    .map((t) => {
      const u = 1 - t;
      return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
    });
}

function numberOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function format(value: number, precision: number): string {
  const rounded = Number(value.toFixed(precision));
  return Object.is(rounded, -0) ? '0' : String(rounded);
}
