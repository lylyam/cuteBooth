/**
 * Session persistence — node **C6**. Contract: `docs/contracts/state.md` §Persistencia.
 *
 * The only module in the app that touches `sessionStorage`. Its job is to make a **refresh**
 * survivable: the user reloads `/decoration` and finds their four photos, their frame, their
 * background and their stickers where they left them, instead of being bounced to `/` by the
 * route guard. It is *not* a save file — `sessionStorage` dies with the tab, on purpose
 * (state.md: "una sesión de photobooth no sobrevive al cierre de la pestaña").
 *
 * ```ts
 * // Wiring (in PhotoBoothContext — NOT done here, that file is booth-state's):
 * const [state, dispatch] = useReducer(photoBoothReducer, initialState, (fallback) =>
 *   loadState() ?? fallback,
 * );
 * useEffect(() => { scheduleSave(state); }, [state]);
 * ```
 *
 * ## Three properties this module guarantees
 *
 * 1. **A failed write never breaks the app.** Every entry point is total: it returns an
 *    outcome, it does not throw. `QuotaExceededError` is an expected result, not a bug, and
 *    so is a `sessionStorage` that throws on *access* (Safari with cookies blocked, an
 *    embedded context with storage partitioned off). The worst case is losing persistence.
 * 2. **Storage holds the current state or nothing** — never a stale snapshot. If the full
 *    write fails, the key is dropped before the smaller one is attempted, and if that fails
 *    too the key is left empty. Restoring photos from *before* a retake would be a worse
 *    bug than restoring nothing.
 * 3. **Garbage never reaches the reducer.** Anything read back is validated field by field
 *    against the live manifests, and an entry that does not validate is deleted (not just
 *    ignored: a 5 MB corrupt blob left in place would also block every future write).
 *
 * ## Why the whole state, photos included — measured, not assumed
 *
 * `state.md` warns that four photos will blow the quota. **They do not, at this app's
 * sizes.** Measured in Chrome 150 with the app's own `sourceToDataUrl` at `JPEG_QUALITY`
 * 0.85, on synthetic 1/f-noise frames (the statistics of a real photograph) at the real
 * slot sizes of `constants/layouts.ts`:
 *
 * | layout      | biggest slot | whole state, 4 photos + frame + background + stickers |
 * | ----------- | ------------ | ----------------------------------------------------- |
 * | `classic`   | 516×363      | ~169 000 chars                                        |
 * | `wide`      | 609×429      | ~216 000 chars                                        |
 * | `spotlight` | 1266×738     | ~228 000 – 251 000 chars                              |
 *
 * Against a measured budget of **~5 242 700 chars** in the same browser (binary-searched
 * with `setItem` until it threw), the worst layout is **~5 %**. Even a pathological frame of
 * pure RGB noise (which no camera produces) lands at ~920 000 chars, ~18 %. Everything that
 * is not a photo — layout, source, frame id, background id, a dozen stickers — is ~1 250
 * chars, i.e. free.
 *
 * The reason the photos are this small is that a `Photo.dataUrl` is never a camera frame: both
 * `useCamera` and `fileToDataUrl` cover-crop to the *slot* size — `EXPORT_SCALE`-multiplied
 * viewBox units, not 1920×1080 — so a 12 MP upload and a 1080p capture both come out the
 * same few tens of KB.
 *
 * So there is nothing to gain by dropping or re-compressing photos up front, and a strip
 * without its photos cannot be reviewed anyway (`useRouteGuard('layoutAndPhotos')` needs
 * four). The photo-less retry below is therefore insurance for a budget this code has not
 * seen — a private window with a 1 MB allowance, a bumped `EXPORT_SCALE` — not the normal
 * path.
 */
import { LAYOUTS } from '../constants/layouts';
import type { LayoutDef } from '../constants/layouts';
import { getBackgroundForLayout } from '../constants/backgrounds';
import { getFrameForLayout } from '../constants/frames';
import { getSticker } from '../constants/stickers';
import type { Photo, PhotoBoothState, PhotoSource, StickerInstance } from '../types/photobooth';

/**
 * The version lives in the key and there are no migrations: change the shape, change the
 * key, and the old entry is simply never read again (and dies with the tab anyway).
 */
export const STORAGE_KEY = 'cutebooth:v1';

/**
 * How long a burst of changes is allowed to coalesce into one write. Trailing edge, and the
 * first change in a burst still lands within this window, so stored state is never more
 * than ~150 ms behind memory.
 *
 * A write of the biggest realistic state measured 0.74 ms here (0.13 stringify + 0.61
 * `setItem`), so this is not a fix for measured jank — `useStickers` already dispatches one
 * `MOVE_STICKER` per *gesture*, not per pointer event. It is there so that clicking fast
 * through 25 background swatches, or the `ADD_PHOTO` that lands in the same tick as a JPEG
 * encode, cannot turn into a stutter on a phone.
 */
const SAVE_DEBOUNCE_MS = 150;

/** Slots in a strip, from the geometry — never a loose `4`. */
const SLOT_COUNT = LAYOUTS.classic.slots.length;

/** A `Photo.dataUrl` is always an image data URL. Anything else is not ours. */
const DATA_URL_PREFIX = 'data:image/';

export type SaveOutcome =
  /** The whole state is in storage. */
  | 'saved'
  /** Quota refused the photos; everything else is in storage and `photos` reads back `[]`. */
  | 'saved-without-photos'
  /** Even the photo-less state did not fit. Storage is now empty, not stale. */
  | 'quota-exceeded'
  /** No usable `sessionStorage` at all. Nothing was written and nothing will be. */
  | 'unavailable';

/**
 * `sessionStorage` or `null` — reading the property itself throws in a partitioned or
 * cookie-blocked context, which is why this is a function and not a module constant.
 */
function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
}

/** `true` when a write has a chance of working. Cheap; does not write a probe value. */
export function isPersistenceAvailable(): boolean {
  return getStorage() !== null;
}

/**
 * Every browser has spelled this differently: `QuotaExceededError` (Chrome, Safari, and the
 * 2025 WebIDL class that now subclasses `DOMException`), `NS_ERROR_DOM_QUOTA_REACHED`
 * (Firefox), legacy code 22. Matching on the shape rather than on `instanceof` keeps all of
 * them, including a future rename, on the retry path instead of on the "storage is broken"
 * path.
 */
function isQuotaError(cause: unknown): boolean {
  if (typeof cause !== 'object' || cause === null) return false;
  const { name, code } = cause as { name?: unknown; code?: unknown };
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED' || code === 22;
}

type WriteResult = 'ok' | 'quota' | 'blocked';

function write(storage: Storage, payload: string): WriteResult {
  try {
    storage.setItem(STORAGE_KEY, payload);
    return 'ok';
  } catch (cause) {
    return isQuotaError(cause) ? 'quota' : 'blocked';
  }
}

function remove(storage: Storage): void {
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // A storage that refuses removeItem refuses everything; there is nothing left to try.
  }
}

/** The last payload actually written, so an unchanged state does not pay for a `setItem`. */
let lastWritten: string | null = null;

/**
 * Writes now. Returns what happened instead of throwing — a caller that ignores the result
 * is still correct, which is the point.
 */
export function saveState(state: PhotoBoothState): SaveOutcome {
  const storage = getStorage();
  if (!storage) return 'unavailable';

  const full = JSON.stringify(state);
  if (full === lastWritten) return 'saved';

  const first = write(storage, full);
  if (first === 'ok') {
    lastWritten = full;
    return 'saved';
  }
  if (first === 'blocked') {
    lastWritten = null;
    return 'unavailable';
  }

  // Quota. Free the key first: on some engines the failed `setItem` leaves the previous
  // (now stale) value in place, and it is also the space the retry needs.
  remove(storage);
  lastWritten = null;

  const lean = JSON.stringify({ ...state, photos: [] satisfies Photo[] });
  if (write(storage, lean) === 'ok') {
    lastWritten = lean;
    warn(
      `the photos did not fit in sessionStorage (${full.length} chars); ` +
        `saved everything else. A refresh will send the user back to /.`,
    );
    return 'saved-without-photos';
  }

  remove(storage);
  return 'quota-exceeded';
}

let pendingState: PhotoBoothState | null = null;
let saveTimer = 0;
let pageHideHooked = false;

/**
 * Coalesced write — this is the one to wire to state changes. Fire and forget: it cannot
 * throw and there is nothing useful to do with its outcome mid-render.
 */
export function scheduleSave(state: PhotoBoothState): void {
  pendingState = state;

  if (typeof window === 'undefined') {
    flushScheduledSave();
    return;
  }

  hookPageHide();
  // Deliberately not re-armed on every call: a long burst of changes must not postpone the
  // write forever, so the timer started by the first change is the one that fires — with
  // whatever the newest state is by then.
  if (saveTimer === 0) {
    saveTimer = window.setTimeout(flushScheduledSave, SAVE_DEBOUNCE_MS);
  }
}

/** Writes a pending coalesced save immediately. No-op when there is nothing pending. */
export function flushScheduledSave(): SaveOutcome | null {
  if (saveTimer !== 0 && typeof window !== 'undefined') {
    window.clearTimeout(saveTimer);
  }
  saveTimer = 0;

  const state = pendingState;
  pendingState = null;
  if (!state) return null;
  return saveState(state);
}

/**
 * A reload fires `pagehide` before the document goes away, and without this the last change
 * inside the debounce window would be the one thing a refresh loses. Registered lazily —
 * importing this module must not have side effects — and only once.
 *
 * `pagehide` and not `beforeunload`: the latter is unreliable on mobile and can bring up a
 * confirmation dialog. Tab *close* needs no handling at all: `sessionStorage` dies with it.
 */
function hookPageHide(): void {
  if (pageHideHooked || typeof window === 'undefined') return;
  pageHideHooked = true;
  window.addEventListener('pagehide', () => {
    flushScheduledSave();
  });
}

/**
 * Forgets the stored session. Also drops a pending coalesced write, or it would resurrect
 * the state that was just cleared ~150 ms later.
 */
export function clearState(): void {
  pendingState = null;
  if (saveTimer !== 0 && typeof window !== 'undefined') {
    window.clearTimeout(saveTimer);
  }
  saveTimer = 0;
  lastWritten = null;

  const storage = getStorage();
  if (storage) remove(storage);
}

/**
 * Reads and validates the stored session, or `null` when there is nothing usable. Never
 * throws: an unparseable or foreign-shaped entry is deleted and reported as `null`, so a
 * `sessionStorage` written by another version of the schema cannot break the boot.
 */
export function loadState(): PhotoBoothState | null {
  const storage = getStorage();
  if (!storage) return null;

  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    warn('the stored session is not JSON; discarding it.');
    remove(storage);
    return null;
  }

  const state = validateState(parsed);
  if (!state) {
    warn('the stored session does not match the current shape; discarding it.');
    remove(storage);
    return null;
  }

  // The hydrated state is what the reducer starts from, so it is also what is already in
  // storage: recording it keeps the first `scheduleSave` from rewriting an identical payload.
  lastWritten = JSON.stringify(state);
  return state;
}

// ---------------------------------------------------------------------------------------
// Validation. Two different failure modes, on purpose:
//
//   * **Structural** damage — not an object, `photos` is not an array, `selectedLayout` is
//     a string that names no layout — means the entry was not written by this schema.
//     `validateState` returns `null` and the caller throws the whole thing away.
//   * **Semantic** drift — a frame id the manifest no longer has, a sticker whose PNG was
//     deleted, a background from the other family — is expected and is *coerced*, per
//     state.md rule 4: the manifest outranks stored state. The session survives; the
//     unresolvable bits become `null` or disappear.
// ---------------------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateState(value: unknown): PhotoBoothState | null {
  if (!isRecord(value)) return null;

  const selectedLayout = validateLayout(value.selectedLayout);
  if (selectedLayout === undefined) return null;

  const source = validateSource(value.source);
  if (source === undefined) return null;

  if (!Array.isArray(value.photos) || !Array.isArray(value.stickers)) return null;

  // `state.frame`/`state.background` resolve through the manifest, which is also where the
  // narrow `FrameId`/`BackgroundId` types come from — so this needs no cast, and an id from
  // another layout (or another background family) resolves to `null` by construction.
  const frame = getFrameForLayout(asOptionalString(value.frame), selectedLayout);
  const background = getBackgroundForLayout(asOptionalString(value.background), selectedLayout);

  return {
    selectedLayout,
    source,
    photos: validatePhotos(value.photos),
    frame: frame?.id ?? null,
    background: background?.id ?? null,
    stickers: validateStickers(value.stickers),
  };
}

/** `LayoutId | null` when it is one of ours, `undefined` when the field is foreign. */
function validateLayout(value: unknown): PhotoBoothState['selectedLayout'] | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return undefined;

  // Indexing a widened view of LAYOUTS and reading `.id` yields a real `LayoutId` — no cast,
  // and no second list of layout names to drift from `constants/layouts.ts`.
  const byName: Record<string, LayoutDef | undefined> = LAYOUTS;
  return byName[value]?.id ?? undefined;
}

/** `PhotoSource | null`, or `undefined` for a value that is neither. */
function validateSource(value: unknown): PhotoSource | null | undefined {
  if (value === null || value === undefined) return null;
  if (value === 'camera' || value === 'upload') return value;
  return undefined;
}

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

/**
 * `Number.isFinite` alone does not narrow `unknown`, and a stored `"9"` must not become a
 * coordinate: a type predicate keeps the validation honest without a cast.
 */
function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * **All or nothing.** One malformed entry drops the whole array, because `photos` is
 * positional — the index *is* the slot — so filtering a bad photo out of the middle would
 * silently shift the rest into slots they were not cropped for (visible immediately in
 * `spotlight`, where slot 0 is 1266×738 and the rest are 402×285). An empty strip sends the
 * user back to shoot four; a shuffled one hands them a wrong-looking result and no clue.
 */
function validatePhotos(value: unknown[]): Photo[] {
  if (value.length > SLOT_COUNT) return [];

  const photos: Photo[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) return [];
    const { id, dataUrl } = entry;
    if (typeof id !== 'string' || id.length === 0) return [];
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith(DATA_URL_PREFIX)) return [];
    photos.push({ id, dataUrl });
  }
  return photos;
}

/**
 * Per sticker, unlike photos: instances are independent, so one whose art was deleted from
 * the manifest is dropped and the rest of the decoration survives. Duplicate `instanceId`s
 * are collapsed — two stickers sharing an id would move together under one drag.
 */
function validateStickers(value: unknown[]): StickerInstance[] {
  const stickers: StickerInstance[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const { instanceId, assetId, x, y } = entry;
    if (typeof instanceId !== 'string' || instanceId.length === 0 || seen.has(instanceId)) continue;
    if (!isFiniteNumber(x) || !isFiniteNumber(y)) continue;

    // The manifest is the source of the narrow `StickerId`, so `sticker.id` is typed and an
    // asset that no longer exists is dropped instead of being drawn as a hole.
    const sticker = getSticker(asOptionalString(assetId));
    if (!sticker) continue;

    seen.add(instanceId);
    stickers.push({ instanceId, assetId: sticker.id, x, y });
  }

  return stickers;
}

function warn(message: string): void {
  if (import.meta.env.DEV) console.warn(`[storage] ${message}`);
}
