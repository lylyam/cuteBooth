/**
 * Manifest plumbing — node X1.
 *
 * `import.meta.glob` hands back a `{ path: url }` object: the paths come from the glob
 * walk, the URLs are already hashed and emitted by Vite. These helpers turn that into an
 * ordered list of `{ name, src }`, which is all an asset manifest really is.
 *
 * Pure string work — no DOM, no React, no fetch. The globs themselves stay in
 * `constants/{frames,backgrounds,stickers}.ts`, because Vite has to see a literal pattern
 * at the call site to expand it.
 */

/**
 * Exactly what
 * `import.meta.glob<string>(pattern, { query: '?url&no-inline', import: 'default', eager: true })`
 * returns: source path → emitted URL.
 */
export type GlobUrlMap = Record<string, string>;

/** One asset: its file stem — which is the id fragment — and the URL Vite emitted for it. */
export type AssetEntry = {
  name: string;
  src: string;
};

/**
 * `'10.png'` after `'9.png'`, and `'Frame 7'` before `'Frame 10'` — the order a human
 * expects from numbered files. A plain `sort()` gives 1, 10, 11, …, 2, which would put the
 * decoration panel in nonsense order.
 */
const NUMERIC_COLLATOR = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/**
 * `'../assets/stickers/pixelStyle/0.png'` → `'0'`.
 *
 * The extension is dropped so that an id survives a re-export of the art to another
 * format: `'pixelStyle/0'` stays valid if `0.png` becomes `0.webp`.
 */
export function fileStem(path: string): string {
  const file = path.slice(path.lastIndexOf('/') + 1);
  const dot = file.lastIndexOf('.');
  return dot > 0 ? file.slice(0, dot) : file;
}

/** Comparator behind every manifest's ordering. Exported so a consumer can reuse it. */
export function compareAssetNames(a: string, b: string): number {
  return NUMERIC_COLLATOR.compare(a, b);
}

/**
 * `{ path: url }` → `{ name, src }[]`, sorted numerically by name.
 *
 * Throws on two files that collapse to the same stem (`1.png` and `1.webp` side by side):
 * that makes one of them unreachable by id, and it is an authoring mistake that shows up
 * on the first page load in dev rather than as a mystery in production. A *missing* file
 * is a different matter and is not an error here — the manifest simply has one entry less,
 * because it is generated from the disk and cannot point at something that is not there.
 */
export function toAssetEntries(glob: GlobUrlMap): AssetEntry[] {
  const entries: AssetEntry[] = [];
  const seen = new Set<string>();

  for (const [path, src] of Object.entries(glob)) {
    const name = fileStem(path);

    if (seen.has(name)) {
      throw new Error(`Duplicate asset name "${name}" in manifest — see ${path}.`);
    }

    seen.add(name);
    entries.push({ name, src });
  }

  entries.sort((a, b) => compareAssetNames(a.name, b.name));
  return entries;
}
