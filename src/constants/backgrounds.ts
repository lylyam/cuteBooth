/**
 * Background manifest — node X1. Contract: docs/contracts/assets.md.
 *
 * The art comes in two folders — `classic` has 25, `wide-and-spotlight` another 21
 * (numbered 1-18, 20-22 — there is no 19, and that is fine) — but **every layout can use
 * all 46** (owner, 2026-10-21). The folder stays in the id only because `classic/1` and
 * `wideAndSpotlight/1` are different pictures, and because it keeps every id ever stored
 * valid. A pattern drawn for one family looks right on the others: it is tiled one natural
 * pixel per canvas unit (decision 19), so its scale does not depend on the strip.
 *
 * Besides the art, a background can be a **solid colour** — `SolidColor`, `'#rrggbb'` —
 * chosen with the rainbow swatch, or **the user's own picture** — `UPLOADED_BACKGROUND`,
 * whose pixels live in `state.uploadedBackground` (only the last one uploaded) and which
 * covers the whole strip instead of tiling. `BackgroundChoice` is what `state.background`
 * holds.
 *
 * The art enters as a **URL** (`?url&no-inline`): 46 PNGs, several MB, emitted next to the
 * JS chunk instead of inlined into it. `canvasUtils` (C2) loads the chosen one and draws it
 * as the bottom layer.
 */
import { toAssetEntries, type GlobUrlMap } from '../utils/assetManifest';

export type BackgroundFamily = 'classic' | 'wideAndSpotlight';

/** `${BackgroundFamily}/${file stem}` — e.g. `'classic/1'`, `'wideAndSpotlight/20'`. */
export type BackgroundId = `${BackgroundFamily}/${string}`;

export type BackgroundDef = {
  id: BackgroundId;
  family: BackgroundFamily;
  /** File stem, `'20'`. Internal; the panel shows the image, never the number. */
  name: string;
  /** URL of the PNG. Emitted by Vite, safe for `<img>` and `loadImage()`. */
  src: string;
};

/** A solid background: always `'#rrggbb'`, lowercase — `toSolidColor` is the only way in. */
export type SolidColor = `#${string}`;

/**
 * `state.background` when the user's own upload is the chosen one. A marker, not the image:
 * the data URL is in `state.uploadedBackground`, so choosing another background and coming
 * back to this one does not mean uploading it again.
 */
export const UPLOADED_BACKGROUND = 'upload';
export type UploadedBackground = typeof UPLOADED_BACKGROUND;

/** What `state.background` holds when a background is chosen: art, a colour, or the upload. */
export type BackgroundChoice = BackgroundId | SolidColor | UploadedBackground;

/** The colour the rainbow swatch starts from, before the user has turned the wheel. */
export const DEFAULT_SOLID_COLOR: SolidColor = '#ffffff';

/** A chosen background, resolved: what `canvasUtils` paints. */
export type ResolvedBackground =
  | { kind: 'image'; def: BackgroundDef }
  | { kind: 'color'; color: SolidColor }
  | { kind: 'upload'; src: string };

/** An uploaded background is always one of ours: a JPEG data URL from `fileToDataUrl`. */
export function isUploadedBackgroundData(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/');
}

// One glob per family folder. Literal calls, not a loop: Vite expands `import.meta.glob`
// at build time and needs to see the pattern.
const BACKGROUND_ART: Record<BackgroundFamily, GlobUrlMap> = {
  classic: import.meta.glob<string>('../assets/backgrounds/classic/*.png', {
    query: '?url&no-inline',
    import: 'default',
    eager: true,
  }),
  wideAndSpotlight: import.meta.glob<string>('../assets/backgrounds/wide-and-spotlight/*.png', {
    query: '?url&no-inline',
    import: 'default',
    eager: true,
  }),
};

function backgroundsOf(family: BackgroundFamily): BackgroundDef[] {
  return toAssetEntries(BACKGROUND_ART[family]).map(({ name, src }) => ({
    id: `${family}/${name}`,
    family,
    name,
    src,
  }));
}

/** In numeric file order — 1, 2, … 25, not 1, 10, 11. Generated from the disk. */
export const BACKGROUNDS: Record<BackgroundFamily, BackgroundDef[]> = {
  classic: backgroundsOf('classic'),
  wideAndSpotlight: backgroundsOf('wideAndSpotlight'),
};

const BACKGROUNDS_BY_ID = new Map<string, BackgroundDef>(
  Object.values(BACKGROUNDS).flatMap((defs) => defs.map((def) => [def.id, def] as const)),
);

/**
 * What the decoration panel lists in step 2, for **any** layout: the `classic` art first,
 * then `wide-and-spotlight`'s, each in numeric file order.
 */
export const BACKGROUND_LIST: BackgroundDef[] = [
  ...BACKGROUNDS.classic,
  ...BACKGROUNDS.wideAndSpotlight,
];

/**
 * Resolves any string — including one rehydrated from `sessionStorage` — to a background,
 * or `null`. The manifest outranks stored state.
 */
export function getBackground(id: string | null | undefined): BackgroundDef | null {
  if (!id) return null;
  return BACKGROUNDS_BY_ID.get(id) ?? null;
}

/** `'#AABBCC'` → `'#aabbcc'`; anything that is not a 6-digit hex colour → `null`. */
export function toSolidColor(value: unknown): SolidColor | null {
  if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) return null;
  return value.toLowerCase() as SolidColor;
}

/**
 * Any stored value — including one rehydrated from `sessionStorage` — as a picture, a colour,
 * the upload or `null`. Valid for every layout: there are no per-layout backgrounds any more.
 * `uploaded` is `state.uploadedBackground`: the marker means nothing without it.
 */
export function resolveBackground(
  value: unknown,
  uploaded: string | null = null,
): ResolvedBackground | null {
  if (value === UPLOADED_BACKGROUND) {
    return isUploadedBackgroundData(uploaded) ? { kind: 'upload', src: uploaded } : null;
  }

  const color = toSolidColor(value);
  if (color) return { kind: 'color', color };

  const def = typeof value === 'string' ? getBackground(value) : null;
  return def ? { kind: 'image', def } : null;
}

/** `resolveBackground`, folded back into what the state stores. */
export function toBackgroundChoice(
  value: unknown,
  uploaded: string | null = null,
): BackgroundChoice | null {
  const resolved = resolveBackground(value, uploaded);
  if (!resolved) return null;
  if (resolved.kind === 'color') return resolved.color;
  if (resolved.kind === 'upload') return UPLOADED_BACKGROUND;
  return resolved.def.id;
}
