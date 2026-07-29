/**
 * The strip on screen, and the strip you download — node C4.
 *
 * A thin, careful wrapper around `canvasUtils` (C2), which already knows how to turn a
 * `PhotoBoothState` into pixels. This hook owns the four things a browser gets wrong when
 * an async painter meets a React component:
 *
 * 1. **Resolution.** C2 paints at whatever pixel size the canvas already has, so sizing the
 *    bitmap is this hook's job: **CSS box × DPR, and never below the layout's own
 *    composition size** (654×1911 / 1404×1257), kept in sync with a `ResizeObserver` and a
 *    `matchMedia` watch on the ratio itself. The floor is node C4b — see `renderSize`.
 * 2. **Ordering.** `composeStrip` is asynchronous. Three `draw()` calls in a row must not
 *    race: they are coalesced to one repaint per animation frame, and two passes are never
 *    in flight at once, so **the last `draw()` always wins**.
 * 3. **Unmounting.** A pass in flight when the component dies paints nothing, sets no
 *    state, and gives its bitmap back.
 * 4. **Object URLs.** `download()` revokes its own, including when the page navigates away
 *    before the timer fires.
 * 5. **The tilt.** `/review` and `/final` show the strip on a slant. Turning the finished
 *    bitmap with CSS makes the compositor resample a raster that is already flat, and the thin
 *    strokes of the frame pay for it; the canvas turns the strip itself instead, so the
 *    geometry is rasterised at its final angle. Node C4c — see `UseCanvasOptions.rotation`.
 *
 * ## How a page uses it
 *
 * ```tsx
 * const canvasRef = useRef<HTMLCanvasElement>(null);
 * // `rotation: 'css'` only where the strip is tilted — /review and /final. See C4c below.
 * const { draw, exportAsBlob, download, isDrawing, isExporting } = useCanvas(canvasRef, {
 *   rotation: 'css',
 * });
 * const { state, dispatch } = usePhotoBooth();
 *
 * // One line. `state` is a new object on every dispatch, so this repaints on every change
 * // of frame, background or sticker, and on nothing else.
 * useEffect(() => {
 *   void draw(state);
 * }, [draw, state]);
 *
 * return (
 *   <div className={styles.previewClassic}>
 *     <canvas ref={canvasRef} className={styles.canvas} aria-label="Your photo strip" />
 *     {isDrawing && <Loading />}
 *   </div>
 * );
 * ```
 *
 * Three rules for the page, all of them load-bearing:
 *
 * - **Always render the `<canvas>`.** Show `Loading` *over* it (the CSS boxes are
 *   `position: relative` for exactly this), never *instead* of it — a canvas that only
 *   mounts once `isDrawing` is false can never be painted, because it is what does the
 *   painting. Mounting it a render late is survivable (the hook picks it up), mounting it
 *   never is not.
 * - **The CSS box sets the aspect ratio**, and it must be the active layout's:
 *   `previewClassic` / `stripClassic` for `classic`, the `wide`/`spotlight` pair for the
 *   other two. The hook fills whatever box it is given; a box with the wrong ratio stretches
 *   the strip, and says so in the console in dev. With `rotation` the ratio to match is the
 *   **envelope's**, not the strip's — see `UseCanvasOptions`.
 * - **`draw` never rejects.** A photo that will not load is a partial drawing plus a dev
 *   warning, not a crash. `exportAsBlob` and `download` *do* reject — a download that
 *   silently produces nothing is worse than an error message.
 *
 * `/final` downloads with `void download()`: no blob, no object URL and no `<a>` in the
 * page's code, so there is nothing there to leak. `exportAsBlob()` stays exposed for
 * anything else that needs the bytes.
 *
 * Layer rule: this imports `utils/` and `constants/` and nothing above them. It does not
 * read the context — the state arrives as a parameter — so `/decoration` can preview a
 * frame the user is only hovering over (`draw({ ...state, frame: hovered })`) without
 * dispatching anything.
 */
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import type { LayoutId } from '../constants/layouts';
import {
  composeStrip,
  exportStripAsBlob,
  getCompositionSize,
  getEnvelopeSize,
} from '../utils/canvasUtils';
import type { CompositionState } from '../utils/canvasUtils';
import type { Size } from '../utils/imageUtils';

/**
 * How long a composition pass has to run before it counts as "loading" and flips
 * `isDrawing`.
 *
 * The delay is the whole point. A repaint from cache — every frame of a sticker drag —
 * takes about a millisecond, so with a threshold it never flips the flag: no flicker of
 * `Loading` under the user's finger, and no re-render of the page at pointer rate. A first
 * paint, which downloads a background, a frame and four photos, blows past it and shows the
 * spinner it should.
 */
const SLOW_PASS_MS = 150;

/**
 * Backstop for the animation frame. `requestAnimationFrame` does not run in a hidden tab,
 * and a page that mounted in a background tab would otherwise sit on `isDrawing` for ever.
 * Whichever of the two fires first cancels the other.
 */
const FRAME_FALLBACK_MS = 250;

/**
 * Revoking a blob URL in the same tick as the click cancels the download in Firefox. A
 * second is far more than the browser needs to pick the URL up, and `dispose()` flushes
 * anything still pending if the page leaves first.
 */
const REVOKE_DELAY_MS = 1000;

/** Relative aspect drift tolerated before the dev warning fires. 2 % is invisible. */
const ASPECT_TOLERANCE = 0.02;

/**
 * Custom property the CSS puts the strip's tilt in, read when `rotation: 'css'` — node **C4c**.
 *
 * A number of degrees (`7.28`, or `7.28deg`). It lives in CSS because the tilt is a design
 * value like a radius or a colour, and above all because it is **media-query dependent**:
 * `/review` straightens the strip below 768 px, and only the stylesheet knows when. Absent or
 * unparseable reads as `0`, which is exactly today's rendering.
 */
const ROTATION_PROPERTY = '--strip-rotation';

/**
 * Ceiling on the bitmap, in device pixels — node C4b.
 *
 * The floor (the composition size) is bounded by the art: 1.25 Mpx for `classic`, 1.76 Mpx
 * for the other two. This cap only ever bites for the other reason a bitmap grows: a very
 * large CSS box on a DPR-3 screen, where 1000 CSS px of `wide` would ask for 3000×2686 ≈
 * 8 Mpx and 32 MB of backing store for detail the drawing does not contain. 4 Mpx is 2.3×
 * the largest composition and well inside every browser's own limit — including iOS Safari,
 * whose canvas area limit is the tightest of them.
 */
const MAX_BITMAP_PIXELS = 4_194_304;

/** No side over this. Older iOS refuses a canvas dimension above 4096, and nothing needs it. */
const MAX_BITMAP_SIDE = 4096;

/**
 * Bitmap size for a canvas whose box measures `device` device pixels — node **C4b**.
 *
 * `max(device box, composition size)`, keeping the box's own proportions.
 *
 * **Why the floor.** The drawing is authored at the layout's composition size, and that is
 * also the size the frame art is rasterised at (`frameArtUtils`) and the size the photos are
 * stored at (`fileToDataUrl` gets the slot in canvas units). A `classic` preview box is
 * 205 CSS px wide, so a bitmap of 205 px asked `drawImage` to squeeze 654 px of drawing into
 * 205 in one step: the frame's 5.82 px stroke landed on 1.82 px, and every stroke, every photo
 * edge and every sticker outline was resampled by canvas2d at a 3.19× reduction. Then the
 * 7.28° rotation of `PhotoResult` resampled that again.
 *
 * Measured on `/review` at DPR 1, the peak darkness of the #222 strokes (luminance 34 when
 * solid) along their length, before → after:
 *
 * | border            | before      | after       |
 * | ----------------- | ----------- | ----------- |
 * | outer, left       | 47 (σ 7.1)  | 39 (σ 2.3)  |
 * | hole 1, top       | 62 (σ 7.9)  | 34 (σ 0.5)  |
 * | hole 3, top       | 65 (σ 4.2)  | 34 (σ 0.4)  |
 *
 * i.e. lines that were a wobbling grey are now solid black. The fourth border measured — the
 * near-vertical left edge of a hole — keeps a ±1 device pixel staircase (σ 18.9): that one is
 * the rotation, not the resolution, and it is unavoidable for a 1.8 CSS px line at 7.28° on a
 * DPR-1 grid. Its *ink* is conserved along the whole length in both configurations, which is
 * why the stroke never actually breaks: measured 0 positions out of 204 with less than half the
 * median ink, before and after.
 *
 * **Why not more than that.** Above the composition size there is nothing left to resolve —
 * the frame raster and the photos have no more pixels to give — so a DPR-3 screen showing a
 * small strip gets `device box` (its own pixels) and stops there.
 *
 * **The knob, if the owner ever says the photos look grainy.** Squeezing 3.19× into 1 CSS px
 * is more than a 2×2 bilinear compositor tap can average, so the preview is now very slightly
 * *sharper* than a mathematically perfect area average — measured against a reference
 * rendering (compose at 654×1911, area-average to 205×599), photo interiors sit at RMSE 2.4/255
 * where a 2× supersample would sit at 0.9. Capping `factor` at 2 buys that back, at the price
 * of the strokes: they go back to 48-58 grey under the rotation. The trade was made for the
 * strokes, which is what was reported.
 *
 * **What this does not change:** the canvas-unit ↔ CSS-px factor that `useStickers` (C5)
 * converts pointer positions with is `LAYOUTS[layout].canvas.width / canvas.clientWidth`
 * (state.md rule 3). It never mentions `canvas.width`, which is precisely why it survives
 * this change untouched — verified by measuring where the strokes land on screen before and
 * after: same position to the pixel, at DPR 1 and DPR 2.
 *
 * **`rotation` — node C4c.** When the strip is turned inside the canvas the target has to hold
 * its **envelope** at composition detail, not the strip: ≈891 × 1980 for `classic` (1.76 Mpx),
 * ≈1552 × 1426 for the other two (2.21 Mpx), both comfortably under the cap. Rotating without
 * raising the floor to the envelope would shrink the drawing to fit and undo C4b.
 */
function renderSize(device: Size, layout: LayoutId | null, rotation: number): Size {
  const composition = layout ? getEnvelopeSize(getCompositionSize(layout), rotation) : null;

  // Below 1 the box already has more pixels than the drawing has detail: its own are enough.
  const factor = composition
    ? Math.max(
        1,
        composition.width / Math.max(1, device.width),
        composition.height / Math.max(1, device.height),
      )
    : 1;

  const width = device.width * factor;
  const height = device.height * factor;

  // One scale for both axes, so the bitmap keeps the box's proportions and cannot introduce a
  // stretch of its own — whatever the box's aspect ratio is, right or wrong.
  const budget = Math.min(
    1,
    Math.sqrt(MAX_BITMAP_PIXELS / Math.max(1, width * height)),
    MAX_BITMAP_SIDE / Math.max(width, height),
  );

  return {
    width: Math.max(1, Math.round(width * budget)),
    height: Math.max(1, Math.round(height * budget)),
  };
}

export type UseCanvasOptions = {
  /**
   * Turn the strip **inside the canvas**, clockwise, in degrees — node **C4c**. Default `0`:
   * the canvas paints the strip straight, exactly as before.
   *
   * `'css'` reads it from the `--strip-rotation` custom property of the `<canvas>` on every
   * pass, so the stylesheet stays the single owner of the angle and of the media query that
   * cancels it. That is the mode `/review` and `/final` use.
   *
   * **Why this exists.** `PhotoResult` used to tilt the finished bitmap with
   * `transform: rotate(7.28deg)`, i.e. rasterise first and turn afterwards. Measured on the
   * interior strokes of the frame (the outlines around the four photos), the compositor's
   * resampling of that turn left them at peak luminance **69 ± 19** where solid `#222` is 34 —
   * a line that beads along its length instead of reading as one rule. Turning inside the
   * canvas, so the geometry is rasterised already tilted, puts them at **35 ± 0.8**, which is
   * the same as an unrotated strip (36 ± 0) and as handing the tilted vector straight to the
   * browser's SVG rasteriser (36 ± 4). See the C4c report for the full table.
   *
   * **Two things the page owes this option**, and both fail loudly rather than silently:
   *
   * 1. **No `transform` on the wrapper.** Both rotations would compound to 14.56°.
   * 2. **The box is the strip's envelope**, not the strip: `min(279.26px, 100%)` and
   *    `aspect-ratio: 296.97 / 659.49` for `classic`, `min(517.23px, 100%)` and
   *    `517.23 / 474.93` for `wide`/`spotlight`. A strip-shaped box letterboxes the drawing
   *    (the scale stays uniform — a rotation with two scales is a shear).
   */
  rotation?: number | 'css';
};

export type UseCanvasResult = {
  /**
   * Paints `state` into the canvas. Coalesced to one repaint per animation frame, and
   * serialised, so a burst of calls costs one composition and **the last one wins**.
   *
   * Never rejects. The promise resolves once the canvas is settled — i.e. this state, or a
   * newer one that superseded it, is on screen.
   */
  draw: (state: CompositionState) => Promise<void>;
  /**
   * The strip as a PNG at export resolution (654×1911 for `classic`, 1404×1257 for the
   * other two), whatever size the preview happens to be. Defaults to the last state handed
   * to `draw`.
   *
   * **Always straight**, whatever `rotation` says: what is downloaded is the strip, not a
   * photograph of the strip lying on a table.
   *
   * Rejects if there is no state yet, if no layout is selected, or if the encode fails.
   */
  exportAsBlob: (state?: CompositionState, mimeType?: string) => Promise<Blob>;
  /**
   * `exportAsBlob` plus saving it, with the object URL revoked for you. The default file
   * name is `cutebooth-<layout>.png` (specs/final.md, supuesto 1).
   */
  download: (state?: CompositionState, fileName?: string) => Promise<void>;
  /** A composition pass has been running for over 150 ms: show `Loading` on top. */
  isDrawing: boolean;
  /** An export is in flight. Disable `Download` with this. */
  isExporting: boolean;
};

type EngineFlags = {
  setDrawing: (value: boolean) => void;
  setExporting: (value: boolean) => void;
};

type Engine = {
  draw: (state: CompositionState) => Promise<void>;
  exportAsBlob: (state?: CompositionState, mimeType?: string) => Promise<Blob>;
  download: (state?: CompositionState, fileName?: string) => Promise<void>;
  /** Mount: arm the observers. Also re-arms after a StrictMode remount. */
  activate: () => void;
  /** Every commit: take the options this render passed, before anything can repaint. */
  setOptions: (options: UseCanvasOptions) => void;
  /** Every commit: bind to the `<canvas>` currently in the ref, whenever it appears. */
  syncCanvas: () => void;
  /** Unmount: cancel everything, resolve everyone, give the bitmap and the URLs back. */
  dispose: () => void;
};

export function useCanvas(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: UseCanvasOptions = {},
): UseCanvasResult {
  const [isDrawing, setIsDrawing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // One engine per mounted hook, created lazily and never re-created: every method below is
  // a stable reference, which is what lets a page put `draw` in an effect's dependencies.
  // `useState` and not a ref, because the ref write would happen during render.
  const [engine] = useState<Engine>(() =>
    createEngine(canvasRef, { setDrawing: setIsDrawing, setExporting: setIsExporting }),
  );

  useEffect(() => {
    engine.activate();
    return () => {
      engine.dispose();
    };
  }, [engine]);

  // No dependency array on purpose. The page may render `Loading` and the `<canvas>` in the
  // same tree but mount the canvas a commit later; a `[]` effect would have run before it
  // existed and never fire again. Re-binding is a pointer comparison, so this is cheap.
  //
  // The options go in here, and not in the effect above, for the ordering: this hook's effects
  // both run before the consumer's `useEffect(() => draw(state))` — a component's effects fire
  // in declaration order — so the first paint already knows its angle.
  useEffect(() => {
    engine.setOptions(options);
    engine.syncCanvas();
  });

  return {
    draw: engine.draw,
    exportAsBlob: engine.exportAsBlob,
    download: engine.download,
    isDrawing,
    isExporting,
  };
}

function createEngine(canvasRef: RefObject<HTMLCanvasElement | null>, flags: EngineFlags): Engine {
  /** False before mount and after unmount: nothing paints and no state is set outside it. */
  let alive = false;
  /** The element the observer is bound to. Kept because a ref can be null by cleanup time. */
  let observed: HTMLCanvasElement | null = null;
  let observer: ResizeObserver | null = null;
  let pixelRatioQuery: MediaQueryList | null = null;

  let frameHandle = 0;
  let fallbackHandle = 0;
  let slowHandle = 0;

  /** A composition pass is in flight. Two are never allowed at once — that is the ordering. */
  let running = false;
  /** The state waiting to be painted. Overwritten, never queued: only the newest matters. */
  let pending: CompositionState | null = null;
  /** The newest state ever requested. What a resize, a DPR change or a remount repaints. */
  let last: CompositionState | null = null;
  let waiters: (() => void)[] = [];

  let drawing = false;
  let exporting = 0;
  const objectUrls = new Set<string>();
  const revokeTimers = new Set<number>();
  let warnedAspect = '';
  /** How the strip is tilted inside the canvas — C4c. `0` until a page asks for otherwise. */
  let tilt: number | 'css' = 0;

  function setOptions(options: UseCanvasOptions): void {
    tilt = options.rotation ?? 0;
  }

  /**
   * The angle this pass will paint at, in degrees.
   *
   * Read once per pass and handed down, rather than consulted from three places: with
   * `rotation: 'css'` every call is a `getComputedStyle`, and a sticker drag runs a pass per
   * animation frame.
   */
  function rotation(): number {
    if (tilt !== 'css') return Number.isFinite(tilt) ? tilt : 0;

    const canvas = canvasRef.current ?? observed;
    if (!canvas) return 0;

    const raw = window.getComputedStyle(canvas).getPropertyValue(ROTATION_PROPERTY).trim();
    if (!raw) return 0;

    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) return 0;
    // A custom property is just a token stream, so the unit is whatever CSS was written with.
    if (/rad\s*$/i.test(raw)) return (value * 180) / Math.PI;
    if (/turn\s*$/i.test(raw)) return value * 360;
    if (/grad\s*$/i.test(raw)) return value * 0.9;
    return value;
  }

  function markDrawing(value: boolean): void {
    if (drawing === value) return; // no redundant setState: a drag would re-render at 120 Hz
    drawing = value;
    if (alive) flags.setDrawing(value);
  }

  function markExporting(delta: number): void {
    const before = exporting > 0;
    exporting = Math.max(0, exporting + delta);
    const after = exporting > 0;
    if (alive && before !== after) flags.setExporting(after);
  }

  /** The layout the next pass will draw. `pump` knows it; a resize has to remember it. */
  function currentLayout(state?: CompositionState | null): LayoutId | null {
    return (state ?? pending ?? last)?.selectedLayout ?? null;
  }

  /**
   * The canvas box in **device pixels**.
   *
   * `clientWidth`/`clientHeight` and not `getBoundingClientRect()`, and it has to stay that
   * way even now that the canvas turns the strip itself (C4c): a CSS `transform` anywhere above
   * the canvas makes the bounding rect the axis-aligned envelope of the rotated element —
   * 279 px for a 205 px strip — and sizing the bitmap from that would squash the drawing by a
   * third. `WebAppOldStyle` alone puts a `translateX(-50%)` on an ancestor. The layout box does
   * not care about transforms, and neither does `ResizeObserver`, whose fractional sizes are
   * preferred when it hands us any.
   */
  function measureDeviceBox(entry?: ResizeObserverEntry): Size | null {
    const canvas = canvasRef.current ?? observed;
    if (!canvas) return null;

    // Exact device pixels, subpixel CSS sizes and DPR included. Chrome, Safari 16.4+, and
    // absent everywhere else — hence the fallback below.
    const devicePixels = entry?.devicePixelContentBoxSize?.[0];
    if (devicePixels) {
      return {
        width: Math.round(devicePixels.inlineSize),
        height: Math.round(devicePixels.blockSize),
      };
    }

    const ratio = window.devicePixelRatio || 1;
    // `inlineSize` is the horizontal one in `horizontal-tb`, which is the whole app.
    const cssBox = entry?.contentBoxSize?.[0];
    const cssWidth = cssBox ? cssBox.inlineSize : canvas.clientWidth;
    const cssHeight = cssBox ? cssBox.blockSize : canvas.clientHeight;
    return { width: Math.round(cssWidth * ratio), height: Math.round(cssHeight * ratio) };
  }

  /**
   * Resizes the bitmap to the box, at composition resolution or better (C4b). Returns `true`
   * when it changed — which **wiped it**.
   */
  function applySize(
    entry?: ResizeObserverEntry,
    state?: CompositionState | null,
    turn = rotation(),
  ): boolean {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const device = measureDeviceBox(entry);
    // A canvas inside a `display: none` panel measures 0. Keep the bitmap it has: zeroing it
    // would throw away a perfectly good drawing on the way to a step that is not visible.
    // This has to be checked on the **box**, before the C4b floor is applied: the floor
    // multiplies, so a 0-wide box would come out of `renderSize` as a 1×1 bitmap — a size that
    // passes any later check and silently discards the drawing.
    if (!device || device.width < 1 || device.height < 1) return false;

    const size = renderSize(device, currentLayout(state), turn);
    if (canvas.width === size.width && canvas.height === size.height) return false;

    canvas.width = size.width;
    canvas.height = size.height;
    return true;
  }

  function handleBoxChange(entry?: ResizeObserverEntry): void {
    if (!alive) return;
    if (!applySize(entry)) return;

    // Assigning width or height clears the canvas, so a resize is always a repaint.
    if (last) {
      pending = last;
      schedule();
    }
  }

  /**
   * Fires when the ratio itself changes — dragging the window to a second monitor, or a
   * browser zoom. A `resize` listener does not catch the first case.
   */
  function watchPixelRatio(): void {
    unwatchPixelRatio();
    if (typeof window.matchMedia !== 'function') return;

    const ratio = window.devicePixelRatio || 1;
    const query = window.matchMedia(`(resolution: ${ratio}dppx)`);
    pixelRatioQuery = query;
    // `once`: the query only ever fires false→true for the ratio it was built with, so it is
    // re-armed for the new one from inside the handler.
    query.addEventListener('change', onPixelRatioChange, { once: true });
  }

  function onPixelRatioChange(): void {
    pixelRatioQuery = null;
    if (!alive) return;
    watchPixelRatio();
    handleBoxChange();
  }

  function unwatchPixelRatio(): void {
    pixelRatioQuery?.removeEventListener('change', onPixelRatioChange);
    pixelRatioQuery = null;
  }

  function cancelFrame(): void {
    if (frameHandle) cancelAnimationFrame(frameHandle);
    frameHandle = 0;
  }

  function cancelFallback(): void {
    if (fallbackHandle) window.clearTimeout(fallbackHandle);
    fallbackHandle = 0;
  }

  /**
   * One pass per animation frame, at most. `useStickers` (C5) calls `draw` once per
   * `pointermove`, which on a 240 Hz pointer is four times what the screen can show.
   */
  function schedule(): void {
    if (!alive || frameHandle || fallbackHandle) return;

    frameHandle = requestAnimationFrame(() => {
      frameHandle = 0;
      cancelFallback();
      void pump();
    });
    fallbackHandle = window.setTimeout(() => {
      fallbackHandle = 0;
      cancelFrame();
      void pump();
    }, FRAME_FALLBACK_MS);
  }

  function startSlowTimer(): void {
    if (slowHandle) return;
    slowHandle = window.setTimeout(() => {
      slowHandle = 0;
      // Still on the same pass 150 ms later: this one is loading images, not repainting.
      if (running) markDrawing(true);
    }, SLOW_PASS_MS);
  }

  function clearSlowTimer(): void {
    if (slowHandle) window.clearTimeout(slowHandle);
    slowHandle = 0;
  }

  function settle(): void {
    if (waiters.length === 0) return;
    const done = waiters;
    waiters = [];
    for (const resolve of done) resolve();
  }

  async function pump(): Promise<void> {
    if (!alive || running) return; // a running pass re-schedules itself when it finishes

    const state = pending;
    if (!state) {
      settle();
      return;
    }

    const canvas = canvasRef.current;
    // No canvas yet. Keep `pending`; `syncCanvas()` starts this again the commit it appears.
    if (!canvas) return;

    pending = null;
    running = true;
    startSlowTimer();

    // One read for the whole pass: the bitmap size, the warning and the painting have to agree
    // on the angle even if a media query flips it mid-flight.
    const turn = rotation();

    try {
      // Before painting, not after: C2 reads the size once the images are in, so a resize
      // mid-load is already handled, but a stale bitmap size never is. The state goes in
      // because the resolution floor is per layout (C4b) and this pass knows which one.
      applySize(undefined, state, turn);
      warnOnAspectMismatch(state, canvas, turn);
      await composeStrip(canvas, state, { rotation: turn });
    } catch (error) {
      // Only reachable when the 2D context itself is gone. Nothing the UI can do about it,
      // and a blank strip beats a crashed page.
      warn(`the strip could not be painted: ${String(error)}`);
    } finally {
      running = false;
      clearSlowTimer();
      markDrawing(false);
      if (pending) schedule();
      else settle();
    }
  }

  function draw(state: CompositionState): Promise<void> {
    last = state;
    pending = state;

    // Before the mount effect — a child's effect runs before its parent's — or after the
    // unmount. `activate()` paints whatever `pending` holds, and resolving now is what keeps
    // this from being a promise nobody ever settles.
    if (!alive) return Promise.resolve();

    const settled = new Promise<void>((resolve) => {
      waiters.push(resolve);
    });
    schedule();
    return settled;
  }

  async function exportAsBlob(state?: CompositionState, mimeType?: string): Promise<Blob> {
    const target = state ?? last;
    if (!target) {
      throw new Error('Nothing to export yet: call draw(state) first, or pass the state in.');
    }

    markExporting(1);
    try {
      // Its own offscreen canvas at layout resolution — the preview is not involved, so
      // exporting mid-drag neither waits for nor disturbs the drawing on screen.
      return await exportStripAsBlob(target, mimeType);
    } finally {
      markExporting(-1);
    }
  }

  async function download(state?: CompositionState, fileName?: string): Promise<void> {
    const target = state ?? last;
    if (!target) {
      throw new Error('Nothing to download yet: call draw(state) first, or pass the state in.');
    }

    const blob = await exportAsBlob(target, 'image/png');
    save(blob, fileName ?? defaultFileName(target.selectedLayout));
  }

  function save(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    objectUrls.add(url);

    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    link.style.display = 'none';

    // Firefox will not follow a click on an anchor that is not in the document.
    document.body.append(link);
    link.click();
    link.remove();

    const timer = window.setTimeout(() => {
      revokeTimers.delete(timer);
      release(url);
    }, REVOKE_DELAY_MS);
    revokeTimers.add(timer);
  }

  function release(url: string): void {
    if (objectUrls.delete(url)) URL.revokeObjectURL(url);
  }

  function warnOnAspectMismatch(
    state: CompositionState,
    canvas: HTMLCanvasElement,
    turn: number,
  ): void {
    if (!import.meta.env.DEV || !state.selectedLayout) return;
    if (canvas.width < 1 || canvas.height < 1) return;

    // Tilted, the shape to match is the envelope: a strip-shaped box letterboxes instead of
    // stretching, which is just as wrong and much easier to mistake for a margin.
    const unit = getEnvelopeSize(getCompositionSize(state.selectedLayout), turn);
    const target = unit.width / unit.height;
    const actual = canvas.width / canvas.height;
    if (Math.abs(actual - target) / target <= ASPECT_TOLERANCE) return;

    const key = `${state.selectedLayout}:${canvas.width}×${canvas.height}`;
    if (key === warnedAspect) return; // once per shape, not once per frame of a drag
    warnedAspect = key;
    warn(
      `the <canvas> box is ${canvas.width}×${canvas.height} but "${state.selectedLayout}" ` +
        `at ${turn}° needs ${Math.round(unit.width)}×${Math.round(unit.height)}: the strip ` +
        `will be ${turn ? 'letterboxed' : 'stretched'}. Check the aspect-ratio class the page ` +
        `puts on the wrapper.`,
    );
  }

  function syncCanvas(): void {
    const canvas = canvasRef.current;
    if (canvas === observed) return;

    observer?.disconnect();
    observer = null;
    observed = canvas;
    if (!canvas) return;

    if (typeof ResizeObserver === 'function') {
      const next = new ResizeObserver((entries) => {
        handleBoxChange(entries[entries.length - 1]);
      });
      try {
        // Exact device pixels, and it fires on a DPR change too. Throws where unsupported.
        next.observe(canvas, { box: 'device-pixel-content-box' });
      } catch {
        next.observe(canvas);
      }
      observer = next;
    }

    // A freshly mounted canvas is 300×150 and empty, whatever its CSS says.
    applySize();
    if (last) pending = last;
    if (pending) schedule();
  }

  function activate(): void {
    alive = true; // StrictMode runs cleanup then setup again: re-arm rather than stay dead
    watchPixelRatio();
    syncCanvas();

    if (last && !pending) pending = last;
    if (pending) schedule();
  }

  function dispose(): void {
    alive = false;
    cancelFrame();
    cancelFallback();
    clearSlowTimer();
    drawing = false; // no setState on the way out
    exporting = 0;

    observer?.disconnect();
    observer = null;
    unwatchPixelRatio();

    for (const timer of revokeTimers) window.clearTimeout(timer);
    revokeTimers.clear();
    for (const url of [...objectUrls]) release(url);

    // Nobody is left to await these. Resolving beats leaving a promise hanging for ever.
    settle();
    pending = null;

    const canvas = canvasRef.current ?? observed;
    observed = null;
    // Only if the element really is gone — StrictMode's fake unmount keeps it in the tree,
    // and this is also what makes a pass that is still in flight paint nothing: C2 returns
    // early on a zero-sized canvas.
    if (canvas && !canvas.isConnected) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }

  return { draw, exportAsBlob, download, activate, setOptions, syncCanvas, dispose };
}

/** specs/final.md, supuesto 1: no date in the name — the browser adds "(1)" on a repeat. */
function defaultFileName(layout: LayoutId | null): string {
  return `cutebooth-${layout ?? 'strip'}.png`;
}

function warn(message: string): void {
  if (import.meta.env.DEV) console.warn(`[useCanvas] ${message}`);
}
