/**
 * Background manifest — node X1. Contract: docs/contracts/assets.md.
 *
 * Backgrounds are **per layout family**, not global: `classic` has its own 25, `wide` and
 * `spotlight` share another 21 (numbered 1-18, 20-22 — there is no 19, and that is fine).
 * A `BackgroundId` from one family is meaningless in the other, so the family is part of
 * the id and `getBackgroundForLayout` is what rehydration must use.
 *
 * The art enters as a **URL** (`?url&no-inline`): 46 PNGs, several MB, emitted next to the
 * JS chunk instead of inlined into it. `canvasUtils` (C2) loads the chosen one and draws it
 * as the bottom layer.
 */
import type { LayoutId } from './layouts';
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

/** Which set a layout draws from. Covers all three layouts, by construction of the type. */
export const BACKGROUND_FAMILY: Record<LayoutId, BackgroundFamily> = {
  classic: 'classic',
  wide: 'wideAndSpotlight',
  spotlight: 'wideAndSpotlight',
};

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

/** What the decoration panel lists in step 2 for the active layout. */
export function backgroundsForLayout(layout: LayoutId): BackgroundDef[] {
  return BACKGROUNDS[BACKGROUND_FAMILY[layout]];
}

/**
 * Resolves any string — including one rehydrated from `sessionStorage` — to a background,
 * or `null`. The manifest outranks stored state.
 */
export function getBackground(id: string | null | undefined): BackgroundDef | null {
  if (!id) return null;
  return BACKGROUNDS_BY_ID.get(id) ?? null;
}

/**
 * Same, but a background from the other family counts as unknown. `classic/1` and
 * `wideAndSpotlight/1` are different pictures; letting one stand in for the other is
 * exactly the bug the family split exists to prevent.
 */
export function getBackgroundForLayout(
  id: string | null | undefined,
  layout: LayoutId | null | undefined,
): BackgroundDef | null {
  const background = getBackground(id);
  if (!background || !layout || background.family !== BACKGROUND_FAMILY[layout]) return null;
  return background;
}
