/**
 * ColorWheel — the solid-background picker of `/decoration` step 2, opened by the rainbow
 * swatch. **Provisional** (owner, 2026-10-21): valid only once she has tried it by hand, and
 * it may yet be swapped for the browser's own `<input type="color">`.
 *
 * Hue around the rim, saturation towards the centre, brightness on a slider underneath. The
 * wheel is three CSS gradients (`ColorWheel.module.css`), not a canvas: a component never
 * calls `getContext`, and the gradients are exactly the HSV model `colorUtils` computes in,
 * so the colour under the pointer is the colour that comes out.
 *
 * Same contract as a sticker drag: `onPreview` on every move, so the strip follows the
 * pointer without touching the global state, and `onCommit` once when the gesture ends.
 *
 * The hex code is a field, not a label: typing a valid one moves the wheel and commits it.
 */
import { useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { toSolidColor } from '../../constants/backgrounds';
import type { SolidColor } from '../../constants/backgrounds';
import {
  hexToHsv,
  hsvToHex,
  hueSatToWheelPoint,
  wheelPointToHueSat,
  type Hsv,
} from '../../utils/colorUtils';
import styles from './ColorWheel.module.css';

type ColorWheelProps = {
  /** Where the wheel starts. Read once, at mount: from then on the wheel keeps its own HSV. */
  initialColor: SolidColor;
  /** Every intermediate colour of a gesture. */
  onPreview: (color: SolidColor) => void;
  /** The colour a gesture ends on. */
  onCommit: (color: SolidColor) => void;
};

/** Arrow-key steps: degrees of hue, and fractions of saturation and brightness. */
const HUE_STEP = 5;
const FRACTION_STEP = 0.05;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * What the hex field accepts: `#a1b2c3` or `a1b2c3`, any case — and, with `shorthand`, the
 * 3-digit form too (`#fa0` → `#ffaa00`). Only when the user is done typing: mid-word,
 * `#ff8` is on its way to `#ff8800`, not a colour of its own. Anything else → `null`.
 */
function parseHexInput(text: string, shorthand = false): SolidColor | null {
  const digits = text.trim().replace(/^#/, '');
  const full =
    shorthand && /^[0-9a-f]{3}$/i.test(digits)
      ? digits
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : digits;
  return toSolidColor(`#${full}`);
}

function ColorWheel({ initialColor, onPreview, onCommit }: ColorWheelProps) {
  // Its own HSV and not the hex: a grey has no hue, so deriving the hue back from the colour
  // would snap it to red every time the brightness touched zero.
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(initialColor));
  const wheelRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  // What the hex field shows while the user is typing in it; `null` means "the current
  // colour". Kept apart so a half-typed `#ff0` is not overwritten, nor applied, mid-word.
  const [hexDraft, setHexDraft] = useState<string | null>(null);

  const color = hsvToHex(hsv);
  const marker = hueSatToWheelPoint(hsv);

  const update = (next: Hsv, commit: boolean) => {
    setHexDraft(null);
    setHsv(next);
    const nextColor = hsvToHex(next);
    if (commit) onCommit(nextColor);
    else onPreview(nextColor);
  };

  const fromPointer = (event: PointerEvent<HTMLDivElement>): Hsv | null => {
    const wheel = wheelRef.current;
    if (!wheel) return null;
    const box = wheel.getBoundingClientRect();
    const radius = box.width / 2;
    const { h, s } = wheelPointToHueSat(
      event.clientX - (box.left + radius),
      event.clientY - (box.top + radius),
      radius,
    );
    return { ...hsv, h, s };
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const next = fromPointer(event);
    if (!next) return;
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    update(next, false);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const next = fromPointer(event);
    if (next) update(next, false);
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    const next = fromPointer(event) ?? hsv;
    update(next, true);
  };

  const handleWheelKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, Partial<Hsv>> = {
      ArrowLeft: { h: (hsv.h - HUE_STEP + 360) % 360 },
      ArrowRight: { h: (hsv.h + HUE_STEP) % 360 },
      ArrowUp: { s: clamp01(hsv.s + FRACTION_STEP) },
      ArrowDown: { s: clamp01(hsv.s - FRACTION_STEP) },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    update({ ...hsv, ...move }, true);
  };

  // The slider commits on release, not on every step, like the wheel does.
  const commitCurrent = () => onCommit(color);

  // A complete 6-digit code applies at once — wheel, slider and strip all jump to it — and
  // commits, since typing it out was the whole gesture. The field keeps the text as typed.
  const handleHexChange = (event: ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value;
    const typed = parseHexInput(text);
    if (typed) {
      setHsv(hexToHsv(typed));
      onCommit(typed);
    }
    setHexDraft(text);
  };

  // Leaving the field (or Enter) is when the 3-digit shorthand counts; anything else
  // half-typed drops back to the colour in use.
  const settleHex = () => {
    const shorthand = hexDraft === null ? null : parseHexInput(hexDraft, true);
    if (shorthand && shorthand !== color) {
      setHsv(hexToHsv(shorthand));
      onCommit(shorthand);
    }
    setHexDraft(null);
  };

  // The hue at full strength, for the slider's track; the wheel's veil reads `--veil`.
  const style = {
    '--veil': 1 - hsv.v,
    '--pure-hue': hsvToHex({ h: hsv.h, s: hsv.s, v: 1 }),
    '--marker-x': `${50 + marker.x * 50}%`,
    '--marker-y': `${50 + marker.y * 50}%`,
    '--picked': color,
  } as CSSProperties;

  return (
    <div className={styles.picker} style={style}>
      <div
        ref={wheelRef}
        className={styles.wheel}
        role="slider"
        tabIndex={0}
        aria-label="Color wheel. Left and right change the hue, up and down the intensity."
        aria-valuemin={0}
        aria-valuemax={359}
        aria-valuenow={Math.round(hsv.h)}
        aria-valuetext={color}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onKeyDown={handleWheelKey}
      >
        <span className={styles.marker} aria-hidden="true" />
      </div>

      <div className={styles.controls}>
        <input
          className={styles.brightness}
          type="range"
          min={0}
          max={100}
          value={Math.round(hsv.v * 100)}
          aria-label="Brightness"
          onChange={(event) => update({ ...hsv, v: Number(event.target.value) / 100 }, false)}
          onPointerUp={commitCurrent}
          onKeyUp={commitCurrent}
        />
        <span className={styles.chosen} aria-hidden="true" />
        <input
          className={styles.hex}
          type="text"
          inputMode="text"
          autoComplete="off"
          spellCheck={false}
          maxLength={7}
          value={hexDraft ?? color}
          aria-label="Hex color code"
          aria-invalid={hexDraft !== null && parseHexInput(hexDraft, true) === null}
          onChange={handleHexChange}
          onBlur={settleHex}
          onKeyDown={(event) => {
            if (event.key === 'Enter') settleHex();
          }}
        />
      </div>
    </div>
  );
}

export default ColorWheel;
