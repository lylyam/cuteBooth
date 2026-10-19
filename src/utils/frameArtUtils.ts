/**
 * Frame artwork → clip paths + a drawable layer. Helper of node C2 (`canvasUtils`).
 *
 * One frame SVG yields **two** things, and both come out of the same text so they cannot
 * drift (see `docs/contracts/assets.md`):
 *
 * 1. the four holes, as `Path2D` in canvas pixels, to clip each photo with;
 * 2. a raster of the frame with **every hole fill neutralised to `none`**, to paint on top.
 *
 * Step 2 is not optional. The holes ship as closed shapes with `fill="#222222"` — that is
 * how they are told apart from the artwork, which is stroke only — so painting the file as
 * it stands would drop four dark blocks over the photos.
 *
 * Browser-only: it needs `fetch`, `DOMParser`, `XMLSerializer`, `Path2D` and a canvas. The
 * measuring maths lives in `svgPathUtils.ts`, which is pure and has none of that.
 */
import type { FrameDef, FrameId, Rect } from '../constants/frames';
import { LAYOUTS } from '../constants/layouts';
import { loadImage, type Size } from './imageUtils';
import {
  parsePathData,
  pathBounds,
  roundedRectSegments,
  scalePathSegments,
  serializePathData,
  translatePathSegments,
  type PathSegment,
} from './svgPathUtils';

/** One photo hole, already in the canvas pixels of `LAYOUTS[layout].canvas`. */
export type FrameHole = {
  /** Clip shape. The path is the **centre line** of the frame stroke, so the stroke painted
   *  on top covers the clip edge and no seam can appear between photo and frame. */
  path: Path2D;
  /** Tight bounding box of `path`. For a shaped hole this is **smaller than the slot** of
   *  `layouts.ts` — up to 6.2 viewBox units — and it, not the slot, is what a photo fits. */
  box: Rect;
  /** The `d` the `Path2D` was built from. Kept for de-duplication and for debugging. */
  pathData: string;
};

export type FrameLayer = {
  id: FrameId;
  /** The art's own coordinate system, read from the file. */
  viewBox: Rect;
  /** In slot order — `holes[i]` is where `photos[i]` goes. Normally 4. */
  holes: FrameHole[];
  /**
   * The strip's outer border, in canvas pixels — the stroke-only `<rect>` that spans the
   * art, rounded corners included. The background is clipped to it, or the pattern pokes
   * out past the rounded corners. `null` if the art has no such shape: the background then
   * fills the whole canvas, as before.
   */
  outline: Path2D | null;
  /** The frame with its hole fills neutralised, rasterised at `LAYOUTS[layout].canvas`. */
  raster: HTMLCanvasElement;
};

/**
 * How many frames stay parsed and rasterised. A `classic` raster is 654×1911×4 B ≈ 5 MB and
 * a `wide` one ≈ 7 MB, so this is a memory budget, not a speed knob: the current frame plus
 * the three last looked at. A miss costs one already-cached fetch plus a re-raster.
 */
export const FRAME_LAYER_CACHE_SIZE = 4;

const cache = new Map<FrameId, Promise<FrameLayer>>();

/**
 * Parses and rasterises a frame, or hands back the cached result. Concurrent calls for the
 * same frame share one fetch; a failed one is evicted so a later draw can retry.
 *
 * Rejects when the art cannot be fetched or is not an SVG. `canvasUtils` treats that as
 * "no frame" and still draws the photos, rather than blanking the strip.
 */
export function loadFrameLayer(frame: FrameDef): Promise<FrameLayer> {
  const cached = cache.get(frame.id);
  if (cached) {
    // Refresh recency: re-inserting moves the key to the end of the Map's iteration order.
    cache.delete(frame.id);
    cache.set(frame.id, cached);
    return cached;
  }

  const pending = buildFrameLayer(frame).catch((error: unknown) => {
    cache.delete(frame.id);
    throw error;
  });

  cache.set(frame.id, pending);
  evictOldest();
  return pending;
}

/** Drops every parsed frame. For a memory panic, or to force a re-read of changed art. */
export function clearFrameLayerCache(): void {
  cache.clear();
}

async function buildFrameLayer(frame: FrameDef): Promise<FrameLayer> {
  const response = await fetch(frame.art);
  if (!response.ok) {
    throw new Error(`Could not fetch frame art ${frame.id}: HTTP ${response.status}.`);
  }

  const document = parseSvg(await response.text(), frame.id);
  const viewBox = readViewBox(document.documentElement, frame.viewBox);
  const canvas = LAYOUTS[frame.layout].canvas;

  const holes = extractHoles(document, viewBox, canvas, frame);
  const outline = extractOutline(document, viewBox, canvas);
  const raster = await rasterize(document, canvas);

  return { id: frame.id, viewBox, holes, outline, raster };
}

/** A border has to cover at least this much of the art to count as the strip's outline. */
const OUTLINE_MIN_COVERAGE = 0.9;

/**
 * The biggest stroke-only `<rect>` of the art, if it covers nearly all of it. All 24 frames
 * draw their outer border that way: inset by half the stroke, `rx` 16.62.
 *
 * The clip follows the stroke's **centre line**, like the holes do: the opaque outer half of
 * the stroke is painted on top, so no background can show past it, and none is left out
 * under its inner half either.
 */
function extractOutline(document: Document, viewBox: Rect, canvas: Size): Path2D | null {
  let best: { pathData: string; area: number } | null = null;

  for (const element of document.querySelectorAll('rect')) {
    if (isFilled(element)) continue;

    const segments = shapeSegments(element);
    if (!segments) continue;

    const inCanvasUnits = scalePathSegments(
      translatePathSegments(segments, -viewBox.x, -viewBox.y),
      canvas.width / viewBox.width,
      canvas.height / viewBox.height,
    );
    const box = pathBounds(inCanvasUnits);
    if (!box) continue;

    const area = box.width * box.height;
    if (!best || area > best.area) best = { pathData: serializePathData(inCanvasUnits), area };
  }

  if (!best || best.area < canvas.width * canvas.height * OUTLINE_MIN_COVERAGE) return null;
  return new Path2D(best.pathData);
}

function parseSvg(text: string, id: FrameId): Document {
  const document = new DOMParser().parseFromString(text, 'image/svg+xml');

  // DOMParser reports XML errors as a <parsererror> node instead of throwing.
  if (document.querySelector('parsererror')) {
    throw new Error(`Frame art ${id} is not well-formed XML.`);
  }
  if (document.documentElement.tagName.toLowerCase() !== 'svg') {
    throw new Error(`Frame art ${id} is not an SVG.`);
  }

  return document;
}

function readViewBox(root: Element, fallback: Rect): Rect {
  const parts = (root.getAttribute('viewBox') ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);

  const usable = parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0;

  if (!usable) return fallback;
  return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
}

/**
 * Every filled shape is a hole; stroke-only shapes are artwork. That single rule — verified
 * against all 24 files — replaces parsing masks or trusting a group name the export dropped.
 *
 * Mutates `document`: each hole it finds gets `fill="none"`, which is what makes the
 * rasterised copy safe to paint over the photos.
 */
function extractHoles(
  document: Document,
  viewBox: Rect,
  canvas: Size,
  frame: FrameDef,
): FrameHole[] {
  const scaleX = canvas.width / viewBox.width;
  const scaleY = canvas.height / viewBox.height;

  const holes: FrameHole[] = [];
  const seen = new Set<string>();

  for (const element of document.querySelectorAll<SVGElement>(
    'path, rect, circle, ellipse, polygon, polyline',
  )) {
    if (!isFilled(element)) continue;

    // Neutralise before anything else can fail: an un-clippable hole must still not paint
    // a dark block over a photo.
    neutraliseFill(element);

    const segments = shapeSegments(element);
    if (!segments) {
      warn(`${frame.id}: a filled <${element.tagName}> could not be measured; hole skipped.`);
      continue;
    }

    const inCanvasUnits = scalePathSegments(
      translatePathSegments(segments, -viewBox.x, -viewBox.y),
      scaleX,
      scaleY,
    );
    const pathData = serializePathData(inCanvasUnits);

    // `spotlight/Frame 18` ships every hole twice — once white, once #222222 — as a
    // flattening artefact. Identical geometry means one hole, or it clips twice.
    if (seen.has(pathData)) continue;
    seen.add(pathData);

    const box = pathBounds(inCanvasUnits);
    if (!box || box.width <= 0 || box.height <= 0) {
      warn(`${frame.id}: a filled <${element.tagName}> has an empty box; hole skipped.`);
      continue;
    }

    holes.push({ path: new Path2D(pathData), box, pathData });
  }

  const ordered = orderBySlot(holes, LAYOUTS[frame.layout].slots);

  if (ordered.length !== LAYOUTS[frame.layout].slots.length) {
    warn(
      `${frame.id}: found ${ordered.length} holes, expected ${LAYOUTS[frame.layout].slots.length}.`,
    );
  }

  return ordered;
}

/**
 * Puts the holes in **photo order** by matching each slot of `layouts.ts` to its nearest
 * hole centre, greedily.
 *
 * Sorting by `y` then `x` — the rule that derived the slot table — is not safe here: a
 * shaped hole's box drifts by a unit or two, so two holes on the same row can come out
 * swapped. Matching against the slots cannot: the slots *are* the definition of "hole i".
 */
function orderBySlot(holes: FrameHole[], slots: readonly Rect[]): FrameHole[] {
  const remaining = [...holes];
  const ordered: FrameHole[] = [];

  for (const slot of slots) {
    if (remaining.length === 0) break;

    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    remaining.forEach((hole, index) => {
      const dx = centre(hole.box).x - centre(slot).x;
      const dy = centre(hole.box).y - centre(slot).y;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });

    ordered.push(remaining.splice(best, 1)[0]);
  }

  // More holes than slots is not something the art does today; keep them, in reading order.
  remaining.sort((a, b) => a.box.y - b.box.y || a.box.x - b.box.x);
  return [...ordered, ...remaining];
}

function centre(rect: Rect): { x: number; y: number } {
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Reads `fill` from the inline style first, then the presentation attribute. */
function fillOf(element: Element): string | null {
  const style = element.getAttribute('style');
  const declaration = style?.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i);
  if (declaration) return declaration[1].trim().toLowerCase();

  const attribute = element.getAttribute('fill');
  return attribute === null ? null : attribute.trim().toLowerCase();
}

function isFilled(element: Element): boolean {
  const fill = fillOf(element);
  return fill !== null && fill !== 'none' && fill !== 'transparent';
}

function neutraliseFill(element: Element): void {
  element.setAttribute('fill', 'none');

  const style = element.getAttribute('style');
  if (!style) return;

  const kept = style
    .split(';')
    .filter((declaration) => !/^\s*fill\s*:/i.test(declaration))
    .join(';');

  if (kept.trim()) element.setAttribute('style', kept);
  else element.removeAttribute('style');
}

function shapeSegments(element: Element): PathSegment[] | null {
  const tag = element.tagName.toLowerCase();

  if (tag === 'path') return parsePathData(element.getAttribute('d') ?? '');

  if (tag === 'rect') {
    return roundedRectSegments({
      x: numberAttribute(element, 'x') ?? 0,
      y: numberAttribute(element, 'y') ?? 0,
      width: numberAttribute(element, 'width') ?? 0,
      height: numberAttribute(element, 'height') ?? 0,
      rx: numberAttribute(element, 'rx'),
      ry: numberAttribute(element, 'ry'),
    });
  }

  // circle / ellipse / polygon / polyline: no frame uses a filled one. If one ever appears
  // the caller warns and the slot rectangle takes over, rather than a dark block appearing.
  return null;
}

function numberAttribute(element: Element, name: string): number | null {
  const raw = element.getAttribute(name);
  if (raw === null) return null;

  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * The neutralised SVG, drawn once into a canvas at export resolution.
 *
 * `width`/`height` are set to the target so the browser rasterises the vector at that size
 * instead of at its 218×637 intrinsic size and then blowing the bitmap up. Drawing into a
 * canvas here — rather than caching the `<img>` — means rasterisation has provably happened
 * before the object URL is revoked, and later draws never re-rasterise.
 */
async function rasterize(document: Document, size: Size): Promise<HTMLCanvasElement> {
  const root = document.documentElement;
  root.setAttribute('width', String(size.width));
  root.setAttribute('height', String(size.height));

  const markup = new XMLSerializer().serializeToString(document);
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));

  try {
    const image = await loadImage(url);

    const canvas = globalThis.document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;

    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get a 2D context for the frame layer.');

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, 0, 0, size.width, size.height);

    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function evictOldest(): void {
  // Map iterates in insertion order and `loadFrameLayer` re-inserts on a hit, so the first
  // key is the least recently used. Evicted rasters are dropped, never zeroed: a draw that
  // is mid-flight may still hold one.
  while (cache.size > FRAME_LAYER_CACHE_SIZE) {
    const oldest = cache.keys().next();
    if (oldest.done) return;
    cache.delete(oldest.value);
  }
}

function warn(message: string): void {
  if (import.meta.env.DEV) console.warn(`[frameArt] ${message}`);
}
