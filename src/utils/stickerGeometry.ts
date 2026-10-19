/**
 * Pointer arithmetic for the sticker drag — node **C5**, the half with no DOM in it.
 *
 * `useStickers` owns the gesture (capture, pointer ids, React state); this module owns the
 * numbers, so the numbers can be checked on their own. Everything here is pure: give it a
 * layout, a CSS-pixel width and a point, and it always answers the same thing.
 *
 * ## The one conversion, and why it is written this way
 *
 * Sticker positions live in **canvas units of the active layout** (654 × 1911 for `classic`,
 * 1404 × 1257 for the other two — `state.md` rule 3). A pointer arrives in CSS pixels. The
 * factor between them is:
 *
 * ```
 * LAYOUTS[layout].canvas.width / canvas.clientWidth
 * ```
 *
 * Two things it deliberately is **not**:
 *
 * - **Not `canvas.width`.** That is the bitmap, which is the CSS box times the device pixel
 *   ratio and then floored/raised again by C4b's resolution rules. Using it puts every
 *   sticker at twice the distance from the origin on a retina screen — and looks perfect on
 *   a DPR-1 laptop, which is what makes it expensive.
 * - **Not `getBoundingClientRect().width`.** For a rotated element that returns the
 *   axis-aligned envelope (279 px for a 205 px strip on `/review` — LECCIONES §5).
 *   `clientWidth` is the layout box and ignores transforms, which is the honest number.
 *
 * The same factor is applied to **both axes**. It is a uniform scale because the CSS box is
 * required to carry the layout's aspect ratio (C4 warns in dev when it does not); deriving y
 * from `clientHeight` instead would quietly paper over a mis-sized box by shearing the
 * drawing's coordinate space against the drawing itself.
 *
 * Layer rule: `utils/` imports `constants/` and `utils/`, nothing above.
 */
import { LAYOUTS, type LayoutId } from '../constants/layouts';
import {
  canvasToSticker,
  getStickerCorners,
  getStickerHandles,
  getStickerSide,
  STICKER_HANDLE_HIT_RADIUS,
  type StickerPlacement,
} from './canvasUtils';

/** A point in the layout's canvas units — the same space `StickerInstance.x/y` live in. */
export type CanvasPoint = { x: number; y: number };

/**
 * A point in CSS pixels, **relative to the canvas' own top-left**.
 *
 * That is what `PointerEvent.offsetX/offsetY` give, and the reason the hook uses them: the
 * browser maps the client point through the element's transform for us, so an ancestor's
 * `translateX(-50%)` (`WebAppOldStyle` has one) or a rotation costs nothing and needs no
 * bounding rect.
 */
export type CssPoint = { x: number; y: number };

/**
 * Canvas units per CSS pixel, or `0` when the canvas has no box to measure (it is inside a
 * `display: none` panel, or has not been laid out yet).
 *
 * Recomputed on **every** pointer event, never cached: the window can be resized in the
 * middle of a drag, and a stale factor would send the sticker somewhere else the moment the
 * user moves the mouse again.
 */
export function getCanvasScale(layout: LayoutId, cssWidth: number): number {
  if (!Number.isFinite(cssWidth) || cssWidth <= 0) return 0;
  return LAYOUTS[layout].canvas.width / cssWidth;
}

/** `point`, in CSS px from the canvas' top-left, as canvas units. `null` if unmeasurable. */
export function toCanvasPoint(
  layout: LayoutId,
  point: CssPoint,
  cssWidth: number,
): CanvasPoint | null {
  const scale = getCanvasScale(layout, cssWidth);
  if (scale <= 0) return null;
  return { x: point.x * scale, y: point.y * scale };
}

/**
 * The sticker under `point`, or `null`.
 *
 * **Topmost wins**: `canvasUtils` paints the array in order, so the last entry is the one on
 * top and therefore the one the user is pointing at. Hence the backwards loop.
 *
 * The target is the **full square** turned with the sticker, not the drawn image — spelled
 * out in `specs/decoration.md` (§3, decisión 18) and in `getStickerCorners`: tracing the
 * artwork of a 20 × 13 sticker would leave a thin target. The point is turned into the
 * sticker's own frame, where the square is upright again. Edges count as inside.
 */
export function hitTestStickers<T extends StickerPlacement>(
  layout: LayoutId,
  stickers: readonly T[],
  point: CanvasPoint,
): T | null {
  for (let index = stickers.length - 1; index >= 0; index -= 1) {
    const sticker = stickers[index];
    const half = getStickerSide(layout, sticker) / 2;
    const local = canvasToSticker(sticker, point);
    if (Math.abs(local.x) <= half && Math.abs(local.y) <= half) {
      return sticker;
    }
  }
  return null;
}

export type StickerHandle = 'rotate' | 'scale';

/**
 * Which handle of the selected sticker is under `point`, or `null`. Asked **before**
 * `hitTestStickers`: a handle sits on the box's corner or outside it, often over another
 * sticker, and grabbing the handle is what the user meant.
 */
export function hitTestHandle(
  layout: LayoutId,
  sticker: StickerPlacement,
  point: CanvasPoint,
): StickerHandle | null {
  const handles = getStickerHandles(layout, sticker);
  const near = (handle: CanvasPoint) =>
    Math.hypot(point.x - handle.x, point.y - handle.y) <= STICKER_HANDLE_HIT_RADIUS;

  // The resize corner first: it overlaps the box, and the rotate handle never does.
  if (near(handles.scale)) return 'scale';
  if (near(handles.rotate)) return 'rotate';
  return null;
}

/** Angle of `point` around `centre`, in degrees, clockwise from the +x axis. */
export function angleAround(centre: CanvasPoint, point: CanvasPoint): number {
  return (Math.atan2(point.y - centre.y, point.x - centre.x) * 180) / Math.PI;
}

/** Distance from `centre` to `point`, in canvas units. */
export function distanceFrom(centre: CanvasPoint, point: CanvasPoint): number {
  return Math.hypot(point.x - centre.x, point.y - centre.y);
}

/** Within this many degrees of upright, sideways or upside down, a turn snaps to it. */
export const ROTATION_SNAP_DEGREES = 4;

/** `degrees` folded into (−180, 180], snapped to the nearest quarter turn when close to one. */
export function normalizeRotation(degrees: number): number {
  let value = degrees % 360;
  if (value > 180) value -= 360;
  if (value <= -180) value += 360;

  const quarter = Math.round(value / 90) * 90;
  if (Math.abs(value - quarter) <= ROTATION_SNAP_DEGREES) value = quarter === -180 ? 180 : quarter;
  return value;
}

/**
 * Does the sticker still touch the strip at all?
 *
 * **This is the delete threshold, and it is deliberately the most forgiving one there is.**
 * The gesture for removing a sticker is dragging it off the strip
 * (`specs/decoration.md`, supuesto 2), but the owner's requirement is that a sticker hanging
 * **half over the edge is a position, not a half-finished deletion**: it stays, and the canvas
 * clips it. So anything that overlaps — one unit of one corner — is kept, and only a hit box
 * with no intersection at all is a delete.
 *
 * Strict comparisons on purpose: a box that merely shares an edge with the strip overlaps in
 * zero area, i.e. nothing of it is visible, i.e. it goes.
 *
 * A turned sticker is tested by the axis-aligned envelope of its turned square. That can keep
 * one whose corner region alone grazes the strip — it errs on the side of keeping, which is
 * the side this threshold exists for (there is no undo).
 */
export function isStickerOnStrip(layout: LayoutId, placement: StickerPlacement): boolean {
  const corners = getStickerCorners(layout, placement);
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  const { canvas } = LAYOUTS[layout];
  return (
    Math.min(...xs) < canvas.width &&
    Math.max(...xs) > 0 &&
    Math.min(...ys) < canvas.height &&
    Math.max(...ys) > 0
  );
}
