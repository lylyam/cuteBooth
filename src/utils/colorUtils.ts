/**
 * Colour arithmetic for the solid-background wheel of `/decoration` step 2.
 *
 * HSV, because it is the model the wheel draws: hue is the angle, saturation the distance
 * from the centre, value a black veil on top. `ColorWheel` paints exactly that with three
 * CSS gradients, so a point under the pointer and the colour this module returns for it are
 * the same colour — no canvas needed, and none allowed in a component.
 *
 * Pure: no DOM, no React. Hue in degrees [0, 360), saturation and value in [0, 1].
 */
import type { SolidColor } from '../constants/backgrounds';

export type Hsv = { h: number; s: number; v: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toHexByte(channel: number): string {
  return Math.round(clamp(channel, 0, 1) * 255)
    .toString(16)
    .padStart(2, '0');
}

/** HSV → `'#rrggbb'`, lowercase — the only shape `SolidColor` takes. */
export function hsvToHex({ h, s, v }: Hsv): SolidColor {
  const hue = (((h % 360) + 360) % 360) / 60;
  const chroma = v * s;
  const x = chroma * (1 - Math.abs((hue % 2) - 1));
  const m = v - chroma;

  const [r, g, b] =
    hue < 1
      ? [chroma, x, 0]
      : hue < 2
        ? [x, chroma, 0]
        : hue < 3
          ? [0, chroma, x]
          : hue < 4
            ? [0, x, chroma]
            : hue < 5
              ? [x, 0, chroma]
              : [chroma, 0, x];

  return `#${toHexByte(r + m)}${toHexByte(g + m)}${toHexByte(b + m)}`;
}

/**
 * `'#rrggbb'` → HSV. A grey has no hue, so it comes back as hue 0: callers that keep a hue
 * across greys (the wheel does, so dragging brightness to black and back does not lose it)
 * keep their own HSV and only use this to start from a stored colour.
 */
export function hexToHsv(hex: SolidColor): Hsv {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const delta = max - Math.min(r, g, b);

  let h = 0;
  if (delta > 0) {
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * ((b - r) / delta + 2);
    else h = 60 * ((r - g) / delta + 4);
  }

  return { h: (h + 360) % 360, s: max === 0 ? 0 : delta / max, v: max };
}

/**
 * A point on the wheel → hue and saturation. `dx`/`dy` are measured from the centre in any
 * unit, `radius` in the same one. Hue 0 sits at 12 o'clock and grows clockwise, which is
 * where CSS `conic-gradient` starts and the way it turns. Outside the rim clamps to it.
 */
export function wheelPointToHueSat(dx: number, dy: number, radius: number): Pick<Hsv, 'h' | 's'> {
  const angle = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return {
    h: (angle + 360) % 360,
    s: radius > 0 ? clamp(Math.hypot(dx, dy) / radius, 0, 1) : 0,
  };
}

/** The inverse, for placing the wheel's marker: a fraction of the radius from the centre. */
export function hueSatToWheelPoint({ h, s }: Pick<Hsv, 'h' | 's'>): { x: number; y: number } {
  const radians = (h * Math.PI) / 180;
  return { x: Math.sin(radians) * s, y: -Math.cos(radians) * s };
}
