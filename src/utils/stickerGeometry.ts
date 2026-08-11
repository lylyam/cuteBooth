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
import { getStickerBox, type StickerPlacement } from './canvasUtils';

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
 * The target is `getStickerBox` — the **full square**, not the drawn image. That is spelled
 * out in `specs/decoration.md` (§3, decisión 18) and in `getStickerBox` itself: the box is
 * about 20 CSS px across in the preview, so tracing the artwork of a 20 × 13 sticker would
 * leave a 10 px tall target. Edges count as inside.
 */
export function hitTestStickers<T extends StickerPlacement>(
  layout: LayoutId,
  stickers: readonly T[],
  point: CanvasPoint,
): T | null {
  for (let index = stickers.length - 1; index >= 0; index -= 1) {
    const sticker = stickers[index];
    const box = getStickerBox(layout, sticker);
    if (
      point.x >= box.x &&
      point.x <= box.x + box.width &&
      point.y >= box.y &&
      point.y <= box.y + box.height
    ) {
      return sticker;
    }
  }
  return null;
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
 */
export function isStickerOnStrip(layout: LayoutId, placement: StickerPlacement): boolean {
  const box = getStickerBox(layout, placement);
  const { canvas } = LAYOUTS[layout];
  return (
    box.x < canvas.width && box.x + box.width > 0 && box.y < canvas.height && box.y + box.height > 0
  );
}
