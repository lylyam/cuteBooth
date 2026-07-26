/**
 * Sticker manifest — node X1. Contract: docs/contracts/assets.md.
 *
 * 273 stickers in four styles. They are the same set for every layout — unlike backgrounds,
 * nothing about a sticker depends on the strip it lands on — so the style is a presentation
 * grouping, and the id carries it only to keep the ids stable and readable.
 *
 * The art enters as a **URL** (`?url&no-inline`): ~37 MB of PNG, emitted next to the JS
 * chunk instead of inlined into it, and only the ones the user actually looks at get
 * fetched. `useStickers` (C5) moves them; `canvasUtils` (C2) draws them last, in array
 * order, so the newest sticker is on top.
 */
import { toAssetEntries, type GlobUrlMap } from '../utils/assetManifest';

/** Presentation order of the tabs in step 3 of `/decoration`. */
export const STICKER_STYLES = ['3dStyle', 'drawStyle', 'feltStyle', 'pixelStyle'] as const;

export type StickerStyle = (typeof STICKER_STYLES)[number];

/** `${StickerStyle}/${file stem}` — e.g. `'3dStyle/12'`, `'pixelStyle/0'`. */
export type StickerId = `${StickerStyle}/${string}`;

export type StickerDef = {
  id: StickerId;
  style: StickerStyle;
  /** File stem, `'12'`. Internal; the panel shows the image. */
  name: string;
  /** URL of the PNG. Emitted by Vite, safe for `<img>` and `loadImage()`. */
  src: string;
};

/**
 * Tab labels for the step 3 panel. **Invented copy** — the folder names are not showable
 * and the panel is not drawn in Figma (see `specs/decoration.md` §Supuestos 5). English,
 * like every other user-facing string. `ui-composer` may override these; it should not
 * hardcode a second set.
 */
export const STICKER_STYLE_LABELS: Record<StickerStyle, string> = {
  '3dStyle': '3D',
  drawStyle: 'Drawn',
  feltStyle: 'Felt',
  pixelStyle: 'Pixel',
};

// One glob per style folder. Literal calls, not a loop: Vite expands `import.meta.glob` at
// build time and needs to see the pattern. New art in one of these folders appears in the
// panel with no code change — that is the whole point of the manifest pattern.
const STICKER_ART: Record<StickerStyle, GlobUrlMap> = {
  '3dStyle': import.meta.glob<string>('../assets/stickers/3dStyle/*.png', {
    query: '?url&no-inline',
    import: 'default',
    eager: true,
  }),
  drawStyle: import.meta.glob<string>('../assets/stickers/drawStyle/*.png', {
    query: '?url&no-inline',
    import: 'default',
    eager: true,
  }),
  feltStyle: import.meta.glob<string>('../assets/stickers/feltStyle/*.png', {
    query: '?url&no-inline',
    import: 'default',
    eager: true,
  }),
  pixelStyle: import.meta.glob<string>('../assets/stickers/pixelStyle/*.png', {
    query: '?url&no-inline',
    import: 'default',
    eager: true,
  }),
};

function stickersOf(style: StickerStyle): StickerDef[] {
  return toAssetEntries(STICKER_ART[style]).map(({ name, src }) => ({
    id: `${style}/${name}`,
    style,
    name,
    src,
  }));
}

/** In numeric file order within each style. Generated from the disk. */
export const STICKERS: Record<StickerStyle, StickerDef[]> = {
  '3dStyle': stickersOf('3dStyle'),
  drawStyle: stickersOf('drawStyle'),
  feltStyle: stickersOf('feltStyle'),
  pixelStyle: stickersOf('pixelStyle'),
};

const STICKERS_BY_ID = new Map<string, StickerDef>(
  STICKER_STYLES.flatMap((style) => STICKERS[style].map((def) => [def.id, def] as const)),
);

/**
 * Resolves any string — including a `StickerInstance.assetId` rehydrated from
 * `sessionStorage` — to a sticker, or `null`. The manifest outranks stored state: an
 * instance whose asset no longer exists is dropped, not drawn as a hole.
 */
export function getSticker(id: string | null | undefined): StickerDef | null {
  if (!id) return null;
  return STICKERS_BY_ID.get(id) ?? null;
}
