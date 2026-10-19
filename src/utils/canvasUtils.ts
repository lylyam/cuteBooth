/**
 * Canvas composition — node C2. The one place where a `PhotoBoothState` becomes pixels.
 *
 * `/review`, `/decoration` and `/final` all show the same picture, so they all come through
 * here: `useCanvas` (C4) calls `composeStrip` to paint the preview and `exportStripAsBlob`
 * to produce the download. Four layers, bottom to top:
 *
 * 1. **background** — the family PNG **tiled**, never stretched. It shows through the paper
 *    area of the frame, which is why frames stay SVG instead of flattened PNGs.
 * 2. **photos** — `photos[i]` into hole `i`, clipped with the hole's own shape.
 * 3. **frame** — the SVG with its hole fills neutralised (see `frameArtUtils`).
 * 4. **stickers** — in array order, so the last one added is on top.
 *
 * **`frame: null` is not "bare" — node C2b.** It means the user has not reached
 * `/decoration` step 1 yet, and it draws the layout's plain rectangular frame
 * (`getEffectiveFrame`): border, 1.94 stroke, rounded corners. Four flat rectangles do not
 * read as a photo strip, and `/review` and `/final` are seen before any frame is chosen.
 * The fallback lives in the manifest, so no file name appears in this module.
 *
 * Two states are drawings, not errors: no background (the strip stays transparent) and fewer
 * than four photos (the remaining holes stay empty). A third — photos as plain unclipped
 * rectangles in the slots of `layouts.ts` — survives only as the degradation for frame art
 * that fails to load; see `photoTargets`.
 *
 * Coordinates: everything is in the **canvas units of the active layout**
 * (`LAYOUTS[layout].canvas`, already multiplied by `EXPORT_SCALE`) — the same units the
 * state stores sticker positions in. The only scaling is the final transform onto the
 * target canvas, so a preview at any size is the download at any size.
 *
 * `devicePixelRatio` is deliberately absent: sizing the on-screen canvas is C4's job. This
 * module composes into whatever pixel size the canvas it is handed already has.
 *
 * Layer rule: `utils/` imports `constants/` and `utils/`, and nothing else. State arrives
 * as a parameter — no context, no hook, no component.
 */
import { getBackgroundForLayout } from '../constants/backgrounds';
import { getEffectiveFrame, type Rect } from '../constants/frames';
import { EXPORT_SCALE, LAYOUTS, type LayoutDef, type LayoutId } from '../constants/layouts';
import { getSticker } from '../constants/stickers';
import type { PhotoBoothState } from '../types/photobooth';
import { clearFrameLayerCache, loadFrameLayer, type FrameLayer } from './frameArtUtils';
import { computeCoverRect, getSourceSize, loadImage, type Size } from './imageUtils';

/**
 * What a composition needs. `PhotoBoothState` satisfies it, so callers pass `state`
 * straight through; `source` is not part of it because a picture does not depend on where
 * the photos came from.
 *
 * `frame: null` draws the layout's default frame (C2b), so `/decoration` can still preview a
 * hover with `draw({ ...state, frame: hovered })` — but **there is no value that means "no
 * frame at all"** any more. If the frame panel ever needs a "None" cell, that is a contract
 * change here and in `getEffectiveFrame`, not something to fake with `null`.
 */
export type CompositionState = Pick<
  PhotoBoothState,
  'selectedLayout' | 'photos' | 'frame' | 'background' | 'stickers'
> & {
  /**
   * **Preview only.** The sticker whose selection box and handles are drawn on top — the
   * rotate and resize gesture of `/decoration`. `exportStripAsBlob` always drops it, so the
   * box can never end up in a download.
   */
  selectedStickerId?: string | null;
};

/** A point in the active layout's canvas units. */
export type StickerPoint = { x: number; y: number };

/**
 * A placed sticker, as far as drawing is concerned: a **centre** in canvas pixels, a turn in
 * degrees clockwise around that centre, and a size as a multiple of the base box.
 */
export type StickerPlacement = { x: number; y: number; rotation: number; scale: number };

/**
 * A sticker fits inside a square box measuring this fraction of the strip's **short side**.
 * The longer side of the image fills the box and the shorter one keeps its proportion:
 * stickers are never stretched and never cropped.
 *
 * The fraction is **40 viewBox units** on `classic` — decision 18 as revised by the owner on
 * 2026-10-18, double the 20 first approved — written as a fraction of `classic` itself, so
 * `classic` comes out at exactly that size and the other two scale up to look the same size
 * in proportion. This is the size a sticker is **added** at; `scale` resizes it from there.
 *
 * The short side, and not the width or the area, because it is the reference that moves
 * least between a tall strip and a landscape one.
 */
export const STICKER_BOX_RATIO = (40 * EXPORT_SCALE) / shortSide('classic');

/** How far the resize handle can shrink or grow a sticker, as a multiple of its base box. */
export const STICKER_MIN_SCALE = 0.5;
export const STICKER_MAX_SCALE = 3;

/**
 * One CSS pixel of the `/decoration` preview, in canvas units. Both previews are drawn at
 * about one CSS px per viewBox unit (217 px for `classic`'s 218, 468 for the others' 468), so
 * a viewBox unit — `EXPORT_SCALE` canvas units — is the size the handles below are measured
 * in. It keeps them the same size on screen in all three layouts.
 */
const PREVIEW_CSS_PX = EXPORT_SCALE;

/** Radius of a drawn handle. */
export const STICKER_HANDLE_RADIUS = 7 * PREVIEW_CSS_PX;
/** Radius a pointer counts as being on a handle: twice the drawing, it is a finger target. */
export const STICKER_HANDLE_HIT_RADIUS = 14 * PREVIEW_CSS_PX;
/** Distance from the box's edge to the rotate handle. */
const ROTATE_HANDLE_OFFSET = 22 * PREVIEW_CSS_PX;
const SELECTION_LINE_WIDTH = 1.5 * PREVIEW_CSS_PX;
/** `--dark-secondary` and white: the box has to read on a dark photo and on a light one. */
const SELECTION_DARK = '#222222';
const SELECTION_LIGHT = '#ffffff';

/** Keeps a scale inside the handle's range. Also what storage clamps a rehydrated one to. */
export function clampStickerScale(scale: number): number {
  if (!Number.isFinite(scale)) return 1;
  return Math.min(STICKER_MAX_SCALE, Math.max(STICKER_MIN_SCALE, scale));
}

/** Decoded images kept around. Bounded, or a session of sticker browsing never gives memory back. */
export const IMAGE_CACHE_SIZE = 32;

const imageCache = new Map<string, Promise<HTMLImageElement>>();

/** Output resolution of a layout: what `exportStripAsBlob` produces and what C4 sizes to. */
export function getCompositionSize(layout: LayoutId): Size {
  const { canvas } = LAYOUTS[layout];
  return { width: canvas.width, height: canvas.height };
}

/**
 * Axis-aligned envelope of `size` turned by `degrees` — node **C4c**.
 *
 * The box a rotated strip needs: `w·cos + h·sin` by `w·sin + h·cos`. For `classic` at 7.28°
 * that is 891 × 1979 against the 654 × 1911 of the strip itself — **1.41 × the area**, which
 * is what the bitmap and the CSS box both have to grow by. `degrees: 0` returns `size`
 * unchanged, so callers can use it unconditionally.
 */
export function getEnvelopeSize(size: Size, degrees: number): Size {
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  return {
    width: size.width * cos + size.height * sin,
    height: size.width * sin + size.height * cos,
  };
}

/**
 * Options of a composition pass. Everything here is about the **target**, never about the
 * picture: the same state composes the same strip whatever these say.
 */
export type ComposeOptions = {
  /**
   * Turn the strip by this many degrees clockwise **inside** the canvas, centred in the
   * target — node **C4c**, and `0` (the default) for the export, which must come out
   * straight.
   *
   * When it is non-zero the canvas is the strip's **envelope**, not the strip: pass a target
   * whose ratio is `getEnvelopeSize(composition, degrees)`, or the drawing is letterboxed
   * rather than stretched (the scale stays uniform on purpose — a rotation with two
   * different scales is a shear).
   */
  rotation?: number;
};

/** Short side of a layout's canvas, in canvas pixels. The reference a sticker scales from. */
function shortSide(layout: LayoutId): number {
  const { canvas } = LAYOUTS[layout];
  return Math.min(canvas.width, canvas.height);
}

/**
 * Side of the **base** sticker box in canvas pixels — the size a sticker is added at: 120 on
 * `classic`, 231 on `wide` and `spotlight`. It depends on the layout — a sticker is a
 * proportion of the strip, not a fixed size, so it looks equally big on all three.
 */
export function getStickerSize(layout: LayoutId): number {
  return Math.round(shortSide(layout) * STICKER_BOX_RATIO);
}

/** Side of this sticker's box: the base box times its own `scale`. */
export function getStickerSide(layout: LayoutId, sticker: StickerPlacement): number {
  return getStickerSize(layout) * clampStickerScale(sticker.scale);
}

/**
 * `local` — a point in the sticker's own frame, origin at its centre, axes turned with it —
 * in canvas units. The one rotation every drawing and hit test of a sticker goes through.
 */
export function stickerToCanvas(sticker: StickerPlacement, local: StickerPoint): StickerPoint {
  const radians = (sticker.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: sticker.x + local.x * cos - local.y * sin,
    y: sticker.y + local.x * sin + local.y * cos,
  };
}

/** The inverse of `stickerToCanvas`: a canvas point in the sticker's own frame. */
export function canvasToSticker(sticker: StickerPlacement, point: StickerPoint): StickerPoint {
  const radians = (sticker.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - sticker.x;
  const dy = point.y - sticker.y;
  return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
}

/**
 * The four corners of the **hit box** — the full square, turned with the sticker — in canvas
 * units, clockwise from the top-left of the upright sticker.
 *
 * **`x` and `y` are the centre**, not the top-left — that is what makes "drop it where the
 * pointer is" work, and what turning around the middle means.
 *
 * The hit box stays the square rather than following the drawn image: a sticker shaped
 * 20 × 13 would otherwise offer a target barely a finger wide. What must never happen is the
 * two rules diverging, so both go through `stickerToCanvas` around the same centre.
 */
export function getStickerCorners(
  layout: LayoutId,
  sticker: StickerPlacement,
): [StickerPoint, StickerPoint, StickerPoint, StickerPoint] {
  const half = getStickerSide(layout, sticker) / 2;
  return [
    stickerToCanvas(sticker, { x: -half, y: -half }),
    stickerToCanvas(sticker, { x: half, y: -half }),
    stickerToCanvas(sticker, { x: half, y: half }),
    stickerToCanvas(sticker, { x: -half, y: half }),
  ];
}

/**
 * The size a sticker's image is painted at: `contain` inside its box, so the long side fills
 * it, the short one keeps the image's proportion, and nothing is ever distorted or cut.
 * Centred on the sticker and turned with it by the caller.
 */
export function getStickerDrawSize(
  layout: LayoutId,
  sticker: StickerPlacement,
  source: Size,
): Size {
  const side = getStickerSide(layout, sticker);
  if (source.width <= 0 || source.height <= 0) return { width: side, height: side };

  const fit = Math.min(side / source.width, side / source.height);
  return { width: source.width * fit, height: source.height * fit };
}

/** Where a selected sticker's two handles are, in canvas units. */
export type StickerHandles = {
  /** Drag it around the centre to turn the sticker. */
  rotate: StickerPoint;
  /** Where the line to `rotate` leaves the box: the middle of the edge facing it. */
  rotateAnchor: StickerPoint;
  /** Drag it towards or away from the centre to resize the sticker. A corner of the box. */
  scale: StickerPoint;
};

/**
 * The handles of a selected sticker. **The drawing and the hit test both read this**, so they
 * cannot disagree about where a handle is.
 *
 * The rotate handle sits above the sticker (in its own frame); the resize handle on its
 * bottom-right corner. Each falls back to the opposite side, or the next corner, when its
 * usual place is off the strip — a sticker pushed against the top edge must still be
 * turnable, and a handle outside the canvas can be neither seen nor grabbed.
 */
export function getStickerHandles(layout: LayoutId, sticker: StickerPlacement): StickerHandles {
  const half = getStickerSide(layout, sticker) / 2;
  const reach = half + ROTATE_HANDLE_OFFSET;
  const inside = (point: StickerPoint) => isInsideCanvas(layout, point);

  const above = stickerToCanvas(sticker, { x: 0, y: -reach });
  const rotateBelow = !inside(above) && inside(stickerToCanvas(sticker, { x: 0, y: reach }));
  const side = rotateBelow ? 1 : -1;

  const corners: StickerPoint[] = [
    { x: half, y: half },
    { x: -half, y: half },
    { x: half, y: -half },
    { x: -half, y: -half },
  ].map((corner) => stickerToCanvas(sticker, corner));

  return {
    rotate: stickerToCanvas(sticker, { x: 0, y: side * reach }),
    rotateAnchor: stickerToCanvas(sticker, { x: 0, y: side * half }),
    scale: corners.find(inside) ?? corners[0],
  };
}

function isInsideCanvas(layout: LayoutId, point: StickerPoint): boolean {
  const { canvas } = LAYOUTS[layout];
  return point.x >= 0 && point.x <= canvas.width && point.y >= 0 && point.y <= canvas.height;
}

/**
 * Paints the whole composition into `canvas`, at the pixel size the canvas already has.
 *
 * Everything is loaded first and painted in one synchronous pass, so two overlapping calls
 * cannot interleave layers: the later one simply repaints the lot. Repeat calls — a sticker
 * drag is one per pointer move — resolve from cache without touching the network.
 *
 * A missing layout, an unreadable photo, art that fails to load: all degrade to a partial
 * drawing plus a dev warning. Nothing here throws for a state the user can reach.
 *
 * One requirement on the caller: the canvas context must keep its alpha. If C4 ever asks
 * for `getContext('2d', { alpha: false })`, "no background" turns black instead of
 * transparent, and the exported PNG loses its transparency with it.
 */
export async function composeStrip(
  canvas: HTMLCanvasElement,
  state: CompositionState,
  options: ComposeOptions = {},
): Promise<void> {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get a 2D canvas context.');

  const prepared = await prepare(state);

  // Read the size *after* loading: C4 may have resized the canvas for a new
  // `devicePixelRatio` while the images were in flight.
  const output: Size = { width: canvas.width, height: canvas.height };
  if (output.width <= 0 || output.height <= 0) return;

  if (!prepared) {
    context.save();
    try {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, output.width, output.height);
    } finally {
      context.restore();
    }
    return;
  }

  paint(context, prepared, output, options.rotation ?? 0);
}

/**
 * The composition as a PNG at the layout's own resolution — 654×1911 for `classic`,
 * 1404×1257 for the other two — whatever size the preview happens to be on screen.
 *
 * The blob is the caller's: `/final` creates the object URL, clicks it and revokes it.
 * Throws only when there is no layout to compose, which is not a reachable UI state.
 */
export async function exportStripAsBlob(
  state: CompositionState,
  mimeType: string = 'image/png',
): Promise<Blob> {
  const layout = layoutOf(state);
  if (!layout) throw new Error('Cannot export the strip: no layout selected.');

  const canvas = document.createElement('canvas');
  canvas.width = layout.canvas.width;
  canvas.height = layout.canvas.height;

  try {
    // Same path as the preview on purpose: what you saw is what you download — minus the
    // selection box, which is a tool on screen and not part of the picture.
    await composeStrip(canvas, { ...state, selectedStickerId: null });
    return await canvasToBlob(canvas, mimeType);
  } finally {
    // Release the backing store now rather than at the next GC (Safari holds on to it).
    canvas.width = 0;
    canvas.height = 0;
  }
}

/** Frees every cached image and frame raster. For tests, and for a memory panic. */
export function clearCompositionCaches(): void {
  imageCache.clear();
  clearFrameLayerCache();
}

type PhotoTarget = { box: Rect; clip: Path2D | null };

type DrawableSticker = { image: HTMLImageElement; placement: StickerPlacement; size: Size };

type Prepared = {
  layout: LayoutDef;
  background: HTMLImageElement | null;
  frame: FrameLayer | null;
  targets: PhotoTarget[];
  photos: (HTMLImageElement | null)[];
  stickers: DrawableSticker[];
  /** The selected sticker, to draw its box and handles over everything. Preview only. */
  selection: StickerPlacement | null;
};

function layoutOf(state: CompositionState): LayoutDef | null {
  // No layout is a state the app passes through, not a fault: clear and move on.
  if (!state.selectedLayout) return null;

  const layout = LAYOUTS[state.selectedLayout] ?? null;
  if (!layout) warn(`unknown layout "${state.selectedLayout}"; nothing to compose.`);
  return layout;
}

async function prepare(state: CompositionState): Promise<Prepared | null> {
  const layout = layoutOf(state);
  if (!layout) return null;

  // The manifest outranks stored state: a frame or background from another layout, or one
  // that no longer exists, counts as not chosen (assets.md rule 3). For the frame, "not
  // chosen" resolves to the layout's plain rectangular one — C2b, see `getEffectiveFrame`.
  // Same code path as a chosen frame on purpose: the hole fills get neutralised by
  // `loadFrameLayer` either way, and a default that skipped that would cover the four photos
  // with `#222222` blocks.
  const frameDef = getEffectiveFrame(state.frame, layout.id);
  const backgroundDef = getBackgroundForLayout(state.background, layout.id);

  const [frame, background] = await Promise.all([
    frameDef
      ? loadFrameLayer(frameDef).catch((error: unknown) => {
          warn(`frame ${frameDef.id} could not be loaded: ${String(error)}`);
          return null;
        })
      : Promise.resolve(null),
    optionalImage(backgroundDef?.src),
  ]);

  const targets = photoTargets(layout, frame);

  const photos = await Promise.all(
    state.photos.slice(0, targets.length).map((photo) => optionalImage(photo.dataUrl)),
  );

  const stickers = (
    await Promise.all(
      state.stickers.map(async (sticker): Promise<DrawableSticker | null> => {
        const definition = getSticker(sticker.assetId);
        if (!definition) return null; // Unknown asset: drop it, do not draw a hole.

        const image = await optionalImage(definition.src);
        if (!image) return null;

        // Geometry resolved here, once: paint stays a straight sequence of drawImage calls.
        return {
          image,
          placement: sticker,
          size: getStickerDrawSize(layout.id, sticker, getSourceSize(image)),
        };
      }),
    )
  ).filter((entry): entry is DrawableSticker => entry !== null);

  const selection = state.selectedStickerId
    ? (state.stickers.find((sticker) => sticker.instanceId === state.selectedStickerId) ?? null)
    : null;

  return { layout, background, frame, targets, photos, stickers, selection };
}

/**
 * Where each photo goes, and with what shape.
 *
 * With a frame it is the hole's own box and path — a cloud inscribed in a slot is smaller
 * than the slot, by up to 6.2 viewBox units, and fitting to the slot would crop the photo
 * wrong (layouts.md rule 6).
 *
 * The slot-rectangle branch is now the **degradation path only**: since C2b there is always
 * a frame to draw, so it is reached when the art cannot be fetched or parsed. Keep it — it is
 * what makes a failed frame download a strip with square photos instead of an empty one.
 */
function photoTargets(layout: LayoutDef, frame: FrameLayer | null): PhotoTarget[] {
  if (frame && frame.holes.length > 0) {
    return frame.holes.map((hole) => ({ box: hole.box, clip: hole.path }));
  }
  return layout.slots.map((slot) => ({ box: slot, clip: null }));
}

function paint(
  context: CanvasRenderingContext2D,
  prepared: Prepared,
  output: Size,
  rotation: number,
): void {
  const unit = prepared.layout.canvas;

  context.save();
  try {
    context.setTransform(1, 0, 0, 1, 0, 0);
    // No background means a transparent strip, so stale pixels have to go.
    context.clearRect(0, 0, output.width, output.height);

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    // From here on every coordinate is in the layout's canvas units.
    applyUnitTransform(context, unit, output, rotation);

    if (prepared.background) {
      drawTiled(context, prepared.background, unit);
    }

    prepared.targets.forEach((target, index) => {
      const photo = prepared.photos[index];
      if (!photo) return;

      context.save();
      try {
        if (target.clip) context.clip(target.clip);
        drawCover(context, photo, target.box);
      } finally {
        context.restore();
      }
    });

    if (prepared.frame) {
      context.drawImage(prepared.frame.raster, 0, 0, unit.width, unit.height);
    }

    for (const { image, placement, size } of prepared.stickers) {
      context.save();
      try {
        context.translate(placement.x, placement.y);
        context.rotate((placement.rotation * Math.PI) / 180);
        context.drawImage(image, -size.width / 2, -size.height / 2, size.width, size.height);
      } finally {
        context.restore();
      }
    }

    if (prepared.selection) {
      paintSelection(context, prepared.layout.id, prepared.selection);
    }
  } finally {
    context.restore();
  }
}

/**
 * The selected sticker's box, the line to its rotate handle, and the two handles. Every
 * stroke twice — a wide white one under a thin dark one — so it reads on any photo.
 */
function paintSelection(
  context: CanvasRenderingContext2D,
  layout: LayoutId,
  sticker: StickerPlacement,
): void {
  const corners = getStickerCorners(layout, sticker);
  const handles = getStickerHandles(layout, sticker);

  const outline = new Path2D();
  corners.forEach((corner, index) => {
    if (index === 0) outline.moveTo(corner.x, corner.y);
    else outline.lineTo(corner.x, corner.y);
  });
  outline.closePath();
  outline.moveTo(handles.rotateAnchor.x, handles.rotateAnchor.y);
  outline.lineTo(handles.rotate.x, handles.rotate.y);

  const knobs = new Path2D();
  for (const handle of [handles.rotate, handles.scale]) {
    knobs.moveTo(handle.x + STICKER_HANDLE_RADIUS, handle.y);
    knobs.arc(handle.x, handle.y, STICKER_HANDLE_RADIUS, 0, Math.PI * 2);
  }

  context.save();
  try {
    context.lineJoin = 'round';
    context.strokeStyle = SELECTION_LIGHT;
    context.lineWidth = SELECTION_LINE_WIDTH * 3;
    context.stroke(outline);
    context.strokeStyle = SELECTION_DARK;
    context.lineWidth = SELECTION_LINE_WIDTH;
    context.stroke(outline);

    context.fillStyle = SELECTION_LIGHT;
    context.fill(knobs);
    context.stroke(knobs);
  } finally {
    context.restore();
  }
}

/**
 * Puts the context in the layout's canvas units, so every coordinate below is a number from
 * `layouts.ts` whatever the target's size or angle.
 *
 * Straight: one scale per axis, which is what lets a mismatched box show as a stretch and be
 * caught by C4's aspect warning. Rotated: **uniform** scale (two would shear), centred in the
 * target, so the strip's envelope fits inside the box and the drawing sits in the middle of it.
 */
function applyUnitTransform(
  context: CanvasRenderingContext2D,
  unit: Size,
  output: Size,
  rotation: number,
): void {
  if (!rotation) {
    context.scale(output.width / unit.width, output.height / unit.height);
    return;
  }

  const envelope = getEnvelopeSize(unit, rotation);
  const scale = Math.min(output.width / envelope.width, output.height / envelope.height);

  context.translate(output.width / 2, output.height / 2);
  context.rotate((rotation * Math.PI) / 180);
  context.scale(scale, scale);
  context.translate(-unit.width / 2, -unit.height / 2);
}

/**
 * Tiles `image` over the whole strip. Backgrounds are patterns, so they repeat — they are
 * never blown up to fit, which on a 440 × 550 source and a 654 × 1911 strip meant a 3.5×
 * upscale of five gingham checks.
 *
 * **One tile is one natural pixel per canvas unit**, i.e. `natural / EXPORT_SCALE` viewBox
 * units. That anchor is the whole point: the pattern is filled in canvas units, so the
 * transform onto the target canvas scales it with everything else and the **repeat count is
 * identical at every resolution** — 1.5 × 3.5 tiles on `classic` whether it is being painted
 * at 218 px wide for the preview or at 654 for the download. Tiling in device pixels instead
 * would show the user one picture and hand them another.
 */
function drawTiled(context: CanvasRenderingContext2D, image: HTMLImageElement, area: Size): void {
  const pattern = context.createPattern(image, 'repeat');

  if (!pattern) {
    // Only happens for an image with no decoded data, which `loadImage` already rules out.
    warn('the background could not be turned into a pattern; skipped.');
    return;
  }

  context.save();
  try {
    context.fillStyle = pattern;
    context.fillRect(0, 0, area.width, area.height);
  } finally {
    context.restore();
  }
}

/** Fills `box` completely, centre-cropping whatever does not fit. */
function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, box: Rect): void {
  const source = getSourceSize(image);
  if (source.width <= 0 || source.height <= 0) return;

  const crop = computeCoverRect(source, { width: box.width, height: box.height });
  context.drawImage(
    image,
    crop.sx,
    crop.sy,
    crop.sWidth,
    crop.sHeight,
    box.x,
    box.y,
    box.width,
    box.height,
  );
}

/** Cached `loadImage`. A failure is a warning and a `null`, never a broken composition. */
async function optionalImage(src: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!src) return null;

  try {
    return await cachedImage(src);
  } catch (error) {
    warn(`image could not be loaded: ${String(error)}`);
    return null;
  }
}

function cachedImage(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached) {
    // Re-inserting moves the key to the end: Map order is the LRU order.
    imageCache.delete(src);
    imageCache.set(src, cached);
    return cached;
  }

  const pending = loadImage(src).catch((error: unknown) => {
    imageCache.delete(src);
    throw error;
  });

  imageCache.set(src, pending);

  while (imageCache.size > IMAGE_CACHE_SIZE) {
    const oldest = imageCache.keys().next();
    if (oldest.done) break;
    imageCache.delete(oldest.value);
  }

  return pending;
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      // Browsers signal failure with a null blob instead of throwing.
      if (blob) resolve(blob);
      else reject(new Error(`Could not encode the strip as ${mimeType}.`));
    }, mimeType);
  });
}

function warn(message: string): void {
  if (import.meta.env.DEV) console.warn(`[canvas] ${message}`);
}
