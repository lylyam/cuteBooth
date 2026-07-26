/**
 * Layout geometry contract — see docs/contracts/layouts.md.
 *
 * The source of truth for every number here is the frame artwork itself
 * (`src/assets/frames/<layout>/Frame *.svg`), not the Upload wireframe: the
 * frame is drawn on top of the photos, so it is the only drawing that can be
 * right. If this ever needs to be re-derived, see "Cómo se leen del SVG" in
 * the contract for the stroke-expansion and ordering rules.
 */
import layoutIcon1 from '../assets/draws/layoutIcon1.svg';
import layoutIcon2 from '../assets/draws/layoutIcon2.svg';
import layoutIcon3 from '../assets/draws/layoutIcon3.svg';

export type LayoutId = 'classic' | 'wide' | 'spotlight';

export type Slot = { x: number; y: number; width: number; height: number };

export type LayoutDef = {
  id: LayoutId;
  label: string; // visible in UI — English
  alt: string; // describes the ARRANGEMENT, not the frame — English
  icon: string; // svg import from assets/draws/
  canvas: { width: number; height: number }; // already scaled by EXPORT_SCALE
  slots: [Slot, Slot, Slot, Slot]; // exactly 4, already scaled by EXPORT_SCALE
};

/**
 * Multiplies the viewBox-unit geometry below into a resolution large enough
 * for a downloadable PNG. Change the output resolution here, in one place —
 * never by hand-multiplying the tables.
 */
export const EXPORT_SCALE = 3;

type RawGeometry = {
  canvas: { width: number; height: number };
  slots: [Slot, Slot, Slot, Slot];
};

// Raw numbers in viewBox units, read off the frame artwork per
// docs/contracts/layouts.md (already stroke-expanded, already sorted by
// y then x — the file order of the <rect>s is not the slot order).
const RAW_GEOMETRY: Record<LayoutId, RawGeometry> = {
  classic: {
    canvas: { width: 218, height: 637 },
    slots: [
      { x: 23, y: 30, width: 172, height: 120.99 },
      { x: 23, y: 164.99, width: 172, height: 120.99 },
      { x: 23, y: 300, width: 172, height: 120.99 },
      { x: 23, y: 434.99, width: 172, height: 120.99 },
    ],
  },
  wide: {
    canvas: { width: 468, height: 419 },
    slots: [
      { x: 23, y: 30, width: 203, height: 143 },
      { x: 242, y: 30, width: 203, height: 143 },
      { x: 23, y: 189, width: 203, height: 143 },
      { x: 242, y: 189, width: 203, height: 143 },
    ],
  },
  spotlight: {
    canvas: { width: 468, height: 419 },
    slots: [
      { x: 23, y: 30, width: 422, height: 246 },
      { x: 23, y: 294, width: 134, height: 95 },
      { x: 167, y: 294, width: 134, height: 95 },
      { x: 311, y: 294, width: 134, height: 95 },
    ],
  },
};

function scaleSlot(slot: Slot): Slot {
  return {
    x: Math.round(slot.x * EXPORT_SCALE),
    y: Math.round(slot.y * EXPORT_SCALE),
    width: Math.round(slot.width * EXPORT_SCALE),
    height: Math.round(slot.height * EXPORT_SCALE),
  };
}

function scaleGeometry(raw: RawGeometry): Pick<LayoutDef, 'canvas' | 'slots'> {
  const [first, second, third, fourth] = raw.slots;
  return {
    canvas: {
      width: Math.round(raw.canvas.width * EXPORT_SCALE),
      height: Math.round(raw.canvas.height * EXPORT_SCALE),
    },
    slots: [scaleSlot(first), scaleSlot(second), scaleSlot(third), scaleSlot(fourth)],
  };
}

export const LAYOUTS: Record<LayoutId, LayoutDef> = {
  classic: {
    id: 'classic',
    label: 'Classic',
    alt: 'vertical strip of 4',
    icon: layoutIcon1,
    ...scaleGeometry(RAW_GEOMETRY.classic),
  },
  wide: {
    id: 'wide',
    label: 'Wide',
    alt: '2×2 grid',
    icon: layoutIcon2,
    ...scaleGeometry(RAW_GEOMETRY.wide),
  },
  spotlight: {
    id: 'spotlight',
    label: 'Spotlight',
    alt: 'one large photo above three small',
    icon: layoutIcon3,
    ...scaleGeometry(RAW_GEOMETRY.spotlight),
  },
};

// Presentation order in LayoutPage — matches the current card order.
export const LAYOUT_LIST: LayoutDef[] = [LAYOUTS.classic, LAYOUTS.wide, LAYOUTS.spotlight];
