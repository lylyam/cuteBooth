/**
 * Canvas composition — node C2. The one place where a `PhotoBoothState` becomes pixels.
 *
 * `/review`, `/decoration` and `/final` all show the same picture, so they all come through
 * here: `useCanvas` (C4) calls `composeStrip` to paint the preview and `exportStripAsBlob`
 * to produce the download. Four layers, bottom to top:
 *
 * 1. **background** — the family PNG, `cover` over the whole strip. It shows through the
 *    paper area of the frame, which is why frames stay SVG instead of flattened PNGs.
 * 2. **photos** — `photos[i]` into hole `i`, clipped with the hole's own shape.
 * 3. **frame** — the SVG with its hole fills neutralised (see `frameArtUtils`).
 * 4. **stickers** — in array order, so the last one added is on top.
 *
 * Three states are drawings, not errors: no frame (photos as plain rectangles in the slots
 * of `layouts.ts`), no background (the strip stays transparent), fewer than four photos
 * (the remaining holes stay empty).
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
import { getFrameForLayout, type Rect } from '../constants/frames';
import { LAYOUTS, type LayoutDef, type LayoutId } from '../constants/layouts';
import { getSticker } from '../constants/stickers';
import type { PhotoBoothState } from '../types/photobooth';
import { clearFrameLayerCache, loadFrameLayer, type FrameLayer } from './frameArtUtils';
import { computeCoverRect, getSourceSize, loadImage, type Size } from './imageUtils';

/**
 * What a composition needs. `PhotoBoothState` satisfies it, so callers pass `state`
 * straight through; `source` is not part of it because a picture does not depend on where
 * the photos came from.
 */
export type CompositionState = Pick<
  PhotoBoothState,
  'selectedLayout' | 'photos' | 'frame' | 'background' | 'stickers'
>;

/** A placed sticker, as far as drawing is concerned: a centre in canvas pixels. */
export type StickerPlacement = { x: number; y: number };

/**
 * Side of a sticker's box, as a fraction of the **shorter** side of the strip: 22 % gives
 * 144 px on `classic` (48 viewBox units on a 218-unit-wide strip) and 277 px on `wide` and
 * `spotlight`. Nothing in the design specifies a sticker size — see SUPUESTOS.
 */
export const STICKER_SIZE_RATIO = 0.22;

/** Decoded images kept around. Bounded, or a session of sticker browsing never gives memory back. */
export const IMAGE_CACHE_SIZE = 32;

const imageCache = new Map<string, Promise<HTMLImageElement>>();

/** Output resolution of a layout: what `exportStripAsBlob` produces and what C4 sizes to. */
export function getCompositionSize(layout: LayoutId): Size {
  const { canvas } = LAYOUTS[layout];
  return { width: canvas.width, height: canvas.height };
}

/** Side of the square a sticker is drawn inside, in canvas pixels. */
export function getStickerSize(layout: LayoutId): number {
  const { canvas } = LAYOUTS[layout];
  return Math.round(Math.min(canvas.width, canvas.height) * STICKER_SIZE_RATIO);
}

/**
 * The square a sticker occupies, in canvas pixels, centred on its stored position.
 *
 * **`x` and `y` are the centre**, not the top-left: that is what makes "drop it where the
 * pointer is" work, and what `ADD_STICKER` means by "the middle of the strip". The image is
 * drawn *inside* this square preserving its aspect ratio, so the box is a superset of the
 * visible art — which is exactly what a forgiving hit test wants. `useStickers` (C5) must
 * hit-test with this function and no other, or dragging drifts from drawing.
 */
export function getStickerBox(layout: LayoutId, sticker: StickerPlacement): Rect {
  const size = getStickerSize(layout);
  return { x: sticker.x - size / 2, y: sticker.y - size / 2, width: size, height: size };
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

type Prepared = {
  layout: LayoutDef;
  background: HTMLImageElement | null;
  frame: FrameLayer | null;
  targets: PhotoTarget[];
  photos: (HTMLImageElement | null)[];
  stickers: { image: HTMLImageElement; box: Rect }[];
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
  // that no longer exists, counts as not chosen (assets.md rule 3).
  const frameDef = getFrameForLayout(state.frame, layout.id);
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

        return { image, box: getStickerBox(layout.id, sticker) };
      }),
    )
  ).filter((entry): entry is { image: HTMLImageElement; box: Rect } => entry !== null);

  return { layout, background, frame, targets, photos, stickers };
}

/**
 * Where each photo goes, and with what shape.
 *
 * With a frame it is the hole's own box and path — a cloud inscribed in a slot is smaller
 * than the slot, by up to 6.2 viewBox units, and fitting to the slot would crop the photo
 * wrong (layouts.md rule 6). With no frame it is the slot rectangle, unclipped.
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
      drawCover(context, prepared.background, { x: 0, y: 0, ...unit });
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

    for (const sticker of prepared.stickers) {
      drawContain(context, sticker.image, sticker.box);
    }
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

/** Fits inside `box` without cropping or distorting, centred. What a sticker wants. */
function drawContain(context: CanvasRenderingContext2D, image: HTMLImageElement, box: Rect): void {
  const source = getSourceSize(image);
  if (source.width <= 0 || source.height <= 0) return;

  const scale = Math.min(box.width / source.width, box.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;

  context.drawImage(
    image,
    box.x + (box.width - width) / 2,
    box.y + (box.height - height) / 2,
    width,
    height,
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
