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
>;

/** A placed sticker, as far as drawing is concerned: a centre in canvas pixels. */
export type StickerPlacement = { x: number; y: number };

/**
 * A sticker fits inside a square box measuring this fraction of the strip's **short side**.
 * The longer side of the image fills the box and the shorter one keeps its proportion:
 * stickers are never stretched and never cropped.
 *
 * The fraction is the 20 viewBox units the owner approved on `classic` written as a
 * fraction of `classic` itself, which is what pins it: **`classic` comes out at exactly the
 * approved size** and the other two scale up to look the same size in proportion, instead
 * of the speck a fixed 20 units made of them on a 468-unit-wide strip.
 *
 * The short side, and not the width or the area, because it is the reference that moves
 * least between a tall strip and a landscape one — the same one this used before.
 */
export const STICKER_BOX_RATIO = (20 * EXPORT_SCALE) / shortSide('classic');

/** Decoded images kept around. Bounded, or a session of sticker browsing never gives memory back. */
export const IMAGE_CACHE_SIZE = 32;

const imageCache = new Map<string, Promise<HTMLImageElement>>();

/** Output resolution of a layout: what `exportStripAsBlob` produces and what C4 sizes to. */
export function getCompositionSize(layout: LayoutId): Size {
  const { canvas } = LAYOUTS[layout];
  return { width: canvas.width, height: canvas.height };
}

/** Short side of a layout's canvas, in canvas pixels. The reference a sticker scales from. */
function shortSide(layout: LayoutId): number {
  const { canvas } = LAYOUTS[layout];
  return Math.min(canvas.width, canvas.height);
}

/**
 * Side of the sticker box in **canvas pixels**: 60 on `classic`, 115 on `wide` and
 * `spotlight`. It depends on the layout — a sticker is a proportion of the strip, not a
 * fixed size, so it looks equally big on all three.
 */
export function getStickerSize(layout: LayoutId): number {
  return Math.round(shortSide(layout) * STICKER_BOX_RATIO);
}

/**
 * The **hit box** of a sticker: the full square, centred on its stored position.
 *
 * **`x` and `y` are the centre**, not the top-left — that is what makes "drop it where the
 * pointer is" work, and what `ADD_STICKER` means by "the middle of the strip".
 *
 * **This is the function `useStickers` (C5) hit-tests with, and the only one.** It stays the
 * square rather than following the drawn image, deliberately: the box is about 20 CSS px in
 * the preview, so a sticker shaped 20 × 13 would otherwise offer a target barely a finger
 * wide. The square is a superset of the art — you can grab a sticker just above or just
 * below its drawing, which on a target this small is a feature. What must never happen is
 * the two rules diverging: draw with `getStickerDrawRect`, hit-test with `getStickerBox`,
 * both centred on the same point.
 */
export function getStickerBox(layout: LayoutId, sticker: StickerPlacement): Rect {
  const size = getStickerSize(layout);
  return { x: sticker.x - size / 2, y: sticker.y - size / 2, width: size, height: size };
}

/**
 * Where a sticker is actually painted: its image scaled to `contain` inside the hit box,
 * centred. The long side fills the box, the short one keeps the image's proportion, and
 * nothing is ever distorted or cut.
 */
export function getStickerDrawRect(
  layout: LayoutId,
  sticker: StickerPlacement,
  source: Size,
): Rect {
  const box = getStickerBox(layout, sticker);
  if (source.width <= 0 || source.height <= 0) return box;

  const scale = Math.min(box.width / source.width, box.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;

  return {
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
    width,
    height,
  };
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

  paint(context, prepared, output);
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
    // Same path as the preview on purpose: what you saw is what you download.
    await composeStrip(canvas, state);
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

type DrawableSticker = { image: HTMLImageElement; rect: Rect };

type Prepared = {
  layout: LayoutDef;
  background: HTMLImageElement | null;
  frame: FrameLayer | null;
  targets: PhotoTarget[];
  photos: (HTMLImageElement | null)[];
  stickers: DrawableSticker[];
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
      state.stickers.map(async (sticker) => {
        const definition = getSticker(sticker.assetId);
        if (!definition) return null; // Unknown asset: drop it, do not draw a hole.

        const image = await optionalImage(definition.src);
        if (!image) return null;

        // Geometry resolved here, once: paint stays a straight sequence of drawImage calls.
        return { image, rect: getStickerDrawRect(layout.id, sticker, getSourceSize(image)) };
      }),
    )
  ).filter((entry): entry is DrawableSticker => entry !== null);

  return { layout, background, frame, targets, photos, stickers };
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

function paint(context: CanvasRenderingContext2D, prepared: Prepared, output: Size): void {
  const unit = prepared.layout.canvas;

  context.save();
  try {
    context.setTransform(1, 0, 0, 1, 0, 0);
    // No background means a transparent strip, so stale pixels have to go.
    context.clearRect(0, 0, output.width, output.height);

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';

    // From here on every coordinate is in the layout's canvas units.
    context.scale(output.width / unit.width, output.height / unit.height);

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

    for (const { image, rect } of prepared.stickers) {
      context.drawImage(image, rect.x, rect.y, rect.width, rect.height);
    }
  } finally {
    context.restore();
  }
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
