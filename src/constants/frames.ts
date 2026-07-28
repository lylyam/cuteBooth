/**
 * Frame manifest — node X1. Contract: docs/contracts/assets.md.
 *
 * A frame file is **the whole strip for one layout**: the outer rounded rectangle plus the
 * four photo holes, stroke `#222222` of `1.94px`, no fill. Frames with shaped holes (cloud,
 * cat ears) replace the rectangle with a `path`, sometimes drawn as a masked fill; either
 * way it is the same single file. `canvasUtils` (C2) paints it as the **top** layer, scaled
 * from `viewBox` to the layout canvas — the scale is `EXPORT_SCALE`, since
 * `LAYOUTS[layout].canvas` is exactly this `viewBox` multiplied by it.
 *
 * A frame id is **scoped to its layout** (`'classic/Frame 7'`). There is no correspondence
 * between the frames of different layouts and none is needed: the layout is chosen before
 * decorating and there is no way back.
 *
 * The art enters as a **URL**, never as inlined content: `?url&no-inline` keeps the 24 SVG
 * files out of the JS chunk and emits them next to it. Anything that needs the *markup*
 * (clipping a shaped hole) fetches `art` at draw time.
 */
import type { LayoutId } from './layouts';
import { EXPORT_SCALE, LAYOUTS } from './layouts';
import { toAssetEntries, type GlobUrlMap } from '../utils/assetManifest';

/** `${LayoutId}/${file stem}` — e.g. `'classic/Frame 7'`. Never valid in another layout. */
export type FrameId = `${LayoutId}/${string}`;

/** Structurally the same as `Slot` in `layouts.ts`; kept separate because a viewBox is not a hole. */
export type Rect = { x: number; y: number; width: number; height: number };

export type FrameDef = {
  id: FrameId;
  layout: LayoutId;
  /** File stem, `'Frame 7'`. An internal name, not UI copy — the menu shows the swatch. */
  name: string;
  /** URL of the SVG. Emitted by Vite, safe for `<img>`, `loadImage()` and `fetch()`. */
  art: string;
  /** The art's own coordinate system. Origin is `0 0` in all 24 files — verified. */
  viewBox: Rect;
  /**
   * Window on `art` that the frame menu shows, in **viewBox units** — see
   * `FRAME_SWATCH` for why this is a rect and not an image.
   */
  swatch: Rect;
};

/** Frames drawn per layout. If this stops being 8, the decoration grid changes shape. */
export const FRAMES_PER_LAYOUT = 8;

/**
 * The **plain rectangular** frame of each layout: the border with four rounded holes and
 * nothing else. These are the three files `docs/contracts/layouts.md` read its slot tables
 * from, so they are the only frames guaranteed to agree with `LAYOUTS[layout].slots` to
 * within the stroke width (verified: drift 0.00).
 *
 * They are the **fallback** of `getEffectiveFrame` — node C2b. A strip with no frame at all
 * does not look like a strip: no border, no rounded corners, four flat rectangles. So until
 * `/decoration` step 1 says otherwise, this is what the strip wears.
 *
 * File stems and not `FrameDef`s, because this has to be declarable before the glob runs.
 * The DEV block below checks each one against the manifest, so a renamed file is a console
 * warning at load, not a silently frameless strip.
 */
const DEFAULT_FRAME_NAME: Record<LayoutId, string> = {
  classic: 'Frame 7',
  wide: 'Frame 7',
  // Not `Frame 7`: `spotlight`'s files are 7, 8, 9, 10, 12, 13, 15, 18 and the rectangular
  // one is the 8. Do not "regularise" this.
  spotlight: 'Frame 8',
};

/**
 * `DEFAULT_FRAME_NAME` as ids. Exported so the decoration panel can highlight the same
 * frame the canvas is drawing without repeating the table — see `getEffectiveFrame`.
 */
export const DEFAULT_FRAME_ID: Record<LayoutId, FrameId> = {
  classic: `classic/${DEFAULT_FRAME_NAME.classic}`,
  wide: `wide/${DEFAULT_FRAME_NAME.wide}`,
  spotlight: `spotlight/${DEFAULT_FRAME_NAME.spotlight}`,
};

/** Breathing room around the first hole in the menu swatch, in viewBox units. */
export const FRAME_SWATCH_MARGIN = 8;

// One glob per layout folder. Three literal calls and not a loop, because Vite expands
// `import.meta.glob` at build time and needs the pattern spelled out; and three folders
// and not `frames/*/`, so that `frames/icons for frames menu/` — unused, the swatches are
// generated from the frame itself — is neither imported nor emitted.
const FRAME_ART: Record<LayoutId, GlobUrlMap> = {
  classic: import.meta.glob<string>('../assets/frames/classic/*.svg', {
    query: '?url&no-inline',
    import: 'default',
    eager: true,
  }),
  wide: import.meta.glob<string>('../assets/frames/wide/*.svg', {
    query: '?url&no-inline',
    import: 'default',
    eager: true,
  }),
  spotlight: import.meta.glob<string>('../assets/frames/spotlight/*.svg', {
    query: '?url&no-inline',
    import: 'default',
    eager: true,
  }),
};

/** The art's viewBox: the layout canvas divided back by `EXPORT_SCALE`. */
function viewBoxOf(layout: LayoutId): Rect {
  const { canvas } = LAYOUTS[layout];
  return {
    x: 0,
    y: 0,
    width: canvas.width / EXPORT_SCALE,
    height: canvas.height / EXPORT_SCALE,
  };
}

/**
 * The menu swatch is the **first hole** — smallest `y`, then smallest `x` — plus a small
 * margin, clamped to the viewBox. `LAYOUTS[layout].slots` is already sorted that way, and
 * the holes of all 8 frames of a layout sit on that same grid (verified against the 24
 * SVGs: the shaped holes agree with the slots to within ~3 units, which the margin covers).
 * That is the point of deriving it: the swatch cannot drift from the art.
 */
function swatchOf(layout: LayoutId): Rect {
  const viewBox = viewBoxOf(layout);
  const [firstSlot] = LAYOUTS[layout].slots;

  const left = firstSlot.x / EXPORT_SCALE - FRAME_SWATCH_MARGIN;
  const top = firstSlot.y / EXPORT_SCALE - FRAME_SWATCH_MARGIN;
  const right = (firstSlot.x + firstSlot.width) / EXPORT_SCALE + FRAME_SWATCH_MARGIN;
  const bottom = (firstSlot.y + firstSlot.height) / EXPORT_SCALE + FRAME_SWATCH_MARGIN;

  const x = Math.max(0, left);
  const y = Math.max(0, top);

  return {
    x,
    y,
    width: Math.min(viewBox.width, right) - x,
    height: Math.min(viewBox.height, bottom) - y,
  };
}

/**
 * Same window for the 8 frames of a layout — what differs between them is the shape drawn
 * inside it. Exported so the panel can size its cells once instead of reading it off a
 * `FrameDef`.
 *
 * **Deviation from the contract, declared:** `assets.md` typed `swatch` as a `string`. No
 * honest string exists. Cropping an SVG needs a viewBox, `<img>` cannot be given one, and
 * `#svgView(...)` fragments are not reliable in `<img>` across browsers — so the choices
 * were to emit 24 new SVG files, to inline the markup into the JS, or to hand the UI the
 * rect and let it crop with its own `viewBox` (or an `overflow: hidden` box scaled by
 * `cell.width / swatch.width`). This is the third.
 */
export const FRAME_SWATCH: Record<LayoutId, Rect> = {
  classic: swatchOf('classic'),
  wide: swatchOf('wide'),
  spotlight: swatchOf('spotlight'),
};

function framesOf(layout: LayoutId): FrameDef[] {
  const viewBox = viewBoxOf(layout);
  const swatch = FRAME_SWATCH[layout];

  return toAssetEntries(FRAME_ART[layout]).map(({ name, src }) => ({
    id: `${layout}/${name}`,
    layout,
    name,
    art: src,
    viewBox,
    swatch,
  }));
}

/** 8 frames per layout, in numeric file order. Generated from the disk: no entry can be dead. */
export const FRAMES: Record<LayoutId, FrameDef[]> = {
  classic: framesOf('classic'),
  wide: framesOf('wide'),
  spotlight: framesOf('spotlight'),
};

const FRAMES_BY_ID = new Map<string, FrameDef>(
  Object.values(FRAMES).flatMap((defs) => defs.map((def) => [def.id, def] as const)),
);

if (import.meta.env.DEV) {
  for (const [layout, defs] of Object.entries(FRAMES)) {
    if (defs.length !== FRAMES_PER_LAYOUT) {
      // A warning and not a throw: fewer frames degrades the menu, it does not break the
      // app. Art going missing must not white-screen a photobooth.
      warn(
        `${layout} has ${defs.length} frames, expected ${FRAMES_PER_LAYOUT}. ` +
          `Check src/assets/frames/${layout}/.`,
      );
    }
  }

  // Checked once, at load, rather than on every draw: `getDefaultFrame` degrades silently to
  // whatever frame the layout does have, and a per-frame warning during a sticker drag would
  // bury the console.
  for (const [layout, id] of Object.entries(DEFAULT_FRAME_ID)) {
    if (!FRAMES_BY_ID.has(id)) {
      warn(
        `the default frame of ${layout} is "${id}", which the manifest does not have. ` +
          `Either the art was renamed or DEFAULT_FRAME_NAME is stale; ` +
          `undecorated strips will fall back to the first frame of the layout.`,
      );
    }
  }
}

/**
 * Resolves any string — including one rehydrated from `sessionStorage` — to a frame, or
 * `null`. The manifest outranks stored state: unknown means `null`.
 */
export function getFrame(id: string | null | undefined): FrameDef | null {
  if (!id) return null;
  return FRAMES_BY_ID.get(id) ?? null;
}

/**
 * Same, but a frame belonging to another layout counts as unknown. This is the check
 * rehydration needs, since a `FrameId` is only meaningful inside its own layout.
 */
export function getFrameForLayout(
  id: string | null | undefined,
  layout: LayoutId | null | undefined,
): FrameDef | null {
  const frame = getFrame(id);
  if (!frame || !layout || frame.layout !== layout) return null;
  return frame;
}

/**
 * The layout's plain rectangular frame — `DEFAULT_FRAME_ID`. `null` only for no layout, or
 * for a layout whose folder is empty.
 *
 * If the named file is not in the manifest it falls back to the layout's **first** frame:
 * some border beats no border, and the DEV block above has already said so out loud.
 */
export function getDefaultFrame(layout: LayoutId | null | undefined): FrameDef | null {
  if (!layout) return null;
  return FRAMES_BY_ID.get(DEFAULT_FRAME_ID[layout]) ?? FRAMES[layout]?.[0] ?? null;
}

/**
 * **What is actually drawn** — node C2b, and the answer to two questions that must agree:
 * *which frame does the canvas paint* and *which cell does the frame panel highlight*.
 *
 * `state.frame` is `null` until `/decoration` step 1 runs, and it also **becomes** `null`
 * whenever a stored id no longer resolves (unknown, or from another layout — `assets.md`
 * rule 3). Both cases mean "the user has not chosen a frame for this layout", and both now
 * resolve to `getDefaultFrame`, because the owner's decision is that a strip is never
 * frameless: `/review` shows the border and the rounded corners from the first moment, and
 * `/decoration` changes them.
 *
 * So `null` reads as **"the default"**, not as "bare". That is a deliberate change to
 * `assets.md` / `state.md`, and the reason it lives here rather than in the reducer: the
 * coercion of an unresolvable id to "not chosen" happens at this point, so this is the only
 * point where a default cannot be bypassed. A reducer that wrote the default on `SET_LAYOUT`
 * would still hand a frameless strip to anyone rehydrating a session whose frame id has since
 * disappeared from the manifest.
 *
 * **U3 must highlight `getEffectiveFrame(state.frame, layout)?.id`**, never `state.frame`, or
 * step 1 opens with the canvas wearing `Frame 7` and no cell selected.
 */
export function getEffectiveFrame(
  id: string | null | undefined,
  layout: LayoutId | null | undefined,
): FrameDef | null {
  return getFrameForLayout(id, layout) ?? getDefaultFrame(layout);
}

function warn(message: string): void {
  if (import.meta.env.DEV) console.warn(`[frames] ${message}`);
}
