/**
 * Dragging, turning and resizing a sticker on the strip — node **C5**, plus the rotate and
 * resize handles the owner asked for on 2026-10-18.
 *
 * Step 3 of `/decoration` lets the user push the stickers they added around the preview and
 * throw the ones they regret off the edge. This hook is the whole gesture: hit test, live
 * position, one `MOVE_STICKER` at the end, one `REMOVE_STICKER` if it left.
 *
 * ## Selection, turning and resizing
 *
 * Pressing a sticker **selects** it: `selectedId` comes back, the page hands it to `draw` as
 * `selectedStickerId`, and the canvas paints a box with two handles around it (preview only —
 * the export drops it). Dragging the round handle above the box turns the sticker around its
 * centre; dragging the corner one resizes it, between `STICKER_MIN_SCALE` and
 * `STICKER_MAX_SCALE`. Same rule as the drag: the live values stay here, and one
 * `TRANSFORM_STICKER` goes out on release. Pressing empty strip clears the selection.
 *
 * ## What it is not
 *
 * **There is no DOM layer of draggable stickers**, and there must not be one — decision 21,
 * written up in `specs/decoration.md` §3.2. The stickers are painted by the canvas
 * (`canvasUtils`, layer 4) at export geometry, which is what makes the preview and the
 * downloaded PNG the same picture. So this hook moves no elements: it only hit-tests against
 * those painted coordinates.
 *
 * An earlier sketch of the screen did plan a 48 px DOM layer in CSS. It was never mounted and
 * the classes have since been deleted. Reintroducing it would draw every sticker twice, at two
 * different sizes — 60 canvas px is ~20 CSS px in a 217-wide preview, not 48.
 *
 * ## How a page uses it
 *
 * ```tsx
 * const canvasRef = useRef<HTMLCanvasElement>(null);
 * const { draw } = useCanvas(canvasRef);          // no rotation: /decoration shows it straight
 * const { state, dispatch } = usePhotoBooth();
 *
 * const { stickers, onPointerDown, onPointerMove, onPointerUp, onPointerCancel } = useStickers(
 *   canvasRef,
 *   {
 *     layout: state.selectedLayout,
 *     stickers: state.stickers,
 *     onMove: (instanceId, x, y) => dispatch({ type: 'MOVE_STICKER', instanceId, x, y }),
 *     onRemove: (instanceId) => dispatch({ type: 'REMOVE_STICKER', instanceId }),
 *   },
 * );
 *
 * // `stickers` is the state's array with the one under the finger at its live position, and
 * // it is the *same array* when nothing is being dragged — so this effect does not loop.
 * useEffect(() => {
 *   void draw({ ...state, stickers });
 * }, [draw, state, stickers]);
 *
 * return (
 *   <canvas
 *     ref={canvasRef}
 *     onPointerDown={onPointerDown}
 *     onPointerMove={onPointerMove}
 *     onPointerUp={onPointerUp}
 *     onPointerCancel={onPointerCancel}
 *   />
 * );
 * ```
 *
 * Same shape as `useCanvas`: **the state arrives as a parameter**. The hook never calls
 * `usePhotoBooth()`, so it cannot be the thing that decides what a drag means — the page
 * wires `onMove`/`onRemove` to dispatches, and a harness can wire them to anything else.
 *
 * ## The five browser traps this closes
 *
 * 1. **`setPointerCapture`, not `mousemove` on `window`.** The pointer keeps reporting to the
 *    canvas after it leaves the element, which is exactly what the "drag it off the strip"
 *    gesture needs, and the events stop when the button comes up even over browser chrome.
 * 2. **CSS px → canvas units on every event**, with `LAYOUTS[layout].canvas.width /
 *    canvas.clientWidth`. Not `canvas.width` (that is the bitmap, i.e. × DPR: stickers land
 *    at double the distance on retina and look right on the developer's laptop) and not
 *    `getBoundingClientRect()` (that is the envelope of a rotated box — LECCIONES §5).
 *    Recomputed per event, so resizing the window mid-drag does not throw the pointer off.
 *    See `utils/stickerGeometry.ts`.
 * 3. **One dispatch per gesture.** The live position lives here, in local state, and is
 *    handed back through `stickers` for the page to draw. A `MOVE_STICKER` per `pointermove`
 *    would rebuild global state 240 times a second.
 * 4. **`touch-action: none`** on the canvas, set here because it is a property of the gesture
 *    rather than of the design: without it a touch drag scrolls the page and the browser
 *    never sends the `pointermove`s. Restored on unmount.
 * 5. **Nothing survives the unmount.** The animation frame is cancelled, the capture
 *    released, and a gesture interrupted by unmount or `pointercancel` dispatches nothing:
 *    the sticker goes back where it was.
 *
 * Layer rule: this imports `constants/`, `utils/` and `types/`, and nothing above them.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { LAYOUTS, type LayoutId } from '../constants/layouts';
import type { StickerInstance } from '../types/photobooth';
import { clampStickerScale } from '../utils/canvasUtils';
import {
  angleAround,
  distanceFrom,
  hitTestHandle,
  hitTestStickers,
  isStickerOnStrip,
  normalizeRotation,
  toCanvasPoint,
} from '../utils/stickerGeometry';

/** Relative drift between the horizontal and vertical scale tolerated before warning in dev. */
const ASPECT_TOLERANCE = 0.02;

export type UseStickersOptions = {
  /** The active layout. `null` disables every handler — there is no coordinate space yet. */
  layout: LayoutId | null;
  /**
   * The stickers as the state holds them. Read on every event, so the hook always hit-tests
   * against what is actually painted; adding one mid-drag is harmless.
   */
  stickers: StickerInstance[];
  /**
   * Fired **once**, on `pointerup`, with the final centre in canvas units, rounded to whole
   * units. Wire it to `MOVE_STICKER`. Not fired when the sticker ends where it started, so a
   * click that does not move anything does not churn global state.
   */
  onMove: (instanceId: string, x: number, y: number) => void;
  /**
   * Fired instead of `onMove` when the sticker was released completely off the strip. Wire it
   * to `REMOVE_STICKER`. "Completely" is the point: any overlap at all, one unit of one
   * corner, counts as a placement the user meant and is kept — see `isStickerOnStrip`.
   */
  onRemove: (instanceId: string) => void;
  /**
   * Fired **once**, on `pointerup`, at the end of a turn or a resize, with the final
   * `rotation` (degrees, one decimal) and `scale`. Wire it to `TRANSFORM_STICKER`. Not fired
   * when neither changed.
   */
  onTransform: (instanceId: string, rotation: number, scale: number) => void;
};

export type UseStickersResult = {
  /**
   * `options.stickers` with the sticker currently under the pointer moved to its live
   * position — what the page should hand to `draw`.
   *
   * **Referentially the same array when no drag is in progress**, so putting it in an
   * effect's dependency list is safe.
   */
  stickers: StickerInstance[];
  /**
   * The sticker showing its box and handles, or `null`. Hand it to `draw` as
   * `selectedStickerId`. Never names a sticker that is no longer in `options.stickers`.
   */
  selectedId: string | null;
  /** Selects a sticker — the page selects the one it just added — or clears with `null`. */
  select: (instanceId: string | null) => void;
  /** `instanceId` of the sticker being dragged, turned or resized, or `null`. */
  draggingId: string | null;
  /**
   * The drag, as it stands right now, would delete the sticker: it is entirely off the strip.
   * For a hint in the UI ("release to remove") if the page wants one — the deletion itself
   * does not depend on the page reading this.
   */
  willRemove: boolean;
  /** Spread onto the `<canvas>`. Stable references. */
  onPointerDown: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  /**
   * Also spread this one. A cancelled pointer (the OS took the gesture, the touch became a
   * scroll) puts the sticker back where it was and dispatches nothing.
   */
  onPointerCancel: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
};

/** What a gesture does: the body moves the sticker, each handle does its own thing. */
type Gesture = 'move' | 'rotate' | 'scale';

/** The gesture in flight. Mutated in place: this, and not React state, is the authority. */
type Drag = {
  pointerId: number;
  instanceId: string;
  gesture: Gesture;
  /** Frozen at `pointerdown`: one gesture, one coordinate space. */
  layout: LayoutId;
  /** Pointer → centre, in canvas units. Keeps the sticker from jumping under the finger. */
  grabX: number;
  grabY: number;
  /** Where it was before the gesture, so an untouched sticker dispatches nothing. */
  originX: number;
  originY: number;
  originRotation: number;
  originScale: number;
  /** Pointer angle and distance around the centre at `pointerdown`: the turn and resize zero. */
  startAngle: number;
  startDistance: number;
  /** Live values in canvas units. `live` state trails these by at most one animation frame. */
  x: number;
  y: number;
  rotation: number;
  scale: number;
};

/** What the render sees. A snapshot of `Drag`, published once per animation frame. */
type LiveDrag = {
  instanceId: string;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  onStrip: boolean;
};

export function useStickers(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  options: UseStickersOptions,
): UseStickersResult {
  const [live, setLive] = useState<LiveDrag | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Mirror of `selectedId` for the stable handlers, written together with it. */
  const selectedRef = useRef<string | null>(null);

  const select = useCallback((instanceId: string | null) => {
    selectedRef.current = instanceId;
    setSelectedId(instanceId);
  }, []);

  // The handlers are stable, so they read the current options through a ref rather than
  // closing over them. Written in an effect and not during render: a pointer event can only
  // happen after a commit, so the ref is never behind when it is read.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });

  const drag = useRef<Drag | null>(null);
  const frame = useRef(0);
  /** The element `touch-action` and the capture listener are attached to. */
  const bound = useRef<HTMLCanvasElement | null>(null);
  const boundTouchAction = useRef('');
  const warned = useRef('');

  const publish = useCallback(() => {
    const current = drag.current;
    if (!current) return;
    setLive({
      instanceId: current.instanceId,
      x: current.x,
      y: current.y,
      rotation: current.rotation,
      scale: current.scale,
      // Rounded, exactly as `finish` will round it. Unrounded, the hint and the outcome can
      // disagree in the half unit either side of the threshold — measured: a live centre of
      // −29.87 reads as "still on the strip" and then commits at −30, which is a delete.
      onStrip: isStickerOnStrip(current.layout, {
        x: Math.round(current.x),
        y: Math.round(current.y),
        rotation: current.rotation,
        scale: current.scale,
      }),
    });
  }, []);

  const cancelFrame = useCallback(() => {
    if (frame.current) cancelAnimationFrame(frame.current);
    frame.current = 0;
  }, []);

  /**
   * At most one re-render per animation frame. A 240 Hz pointer would otherwise re-render the
   * page four times for every frame the screen can show, and `useCanvas` would coalesce three
   * of the four repaints away anyway.
   */
  const schedule = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      publish();
    });
  }, [publish]);

  /**
   * The pointer in canvas units, measured fresh. `offsetX`/`offsetY` and not
   * `clientX - rect.left`: the browser has already mapped the point through the element's
   * transform, and under pointer capture it keeps doing so for a pointer that has left the
   * element — which is how a position outside the strip gets its negative coordinates.
   */
  const pointerPoint = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement, layout: LayoutId) => {
      const cssWidth = canvas.clientWidth;
      warnOnAspectMismatch(canvas, layout, warned);
      return toCanvasPoint(
        layout,
        { x: event.nativeEvent.offsetX, y: event.nativeEvent.offsetY },
        cssWidth,
      );
    },
    [],
  );

  /** Ends the gesture. `commit` false — cancel, unmount — puts the sticker back untouched. */
  const finish = useCallback(
    (commit: boolean) => {
      const current = drag.current;
      drag.current = null;
      cancelFrame();
      setLive(null);
      if (!current) return;

      const canvas = bound.current;
      if (canvas?.hasPointerCapture(current.pointerId)) {
        canvas.releasePointerCapture(current.pointerId);
      }
      if (!commit) return;

      if (current.gesture !== 'move') {
        // One decimal of a degree and three of a scale: below anything the eye can see, and
        // it keeps the stored state free of float noise.
        const rotation = Math.round(current.rotation * 10) / 10;
        const scale = Math.round(current.scale * 1000) / 1000;
        if (rotation === current.originRotation && scale === current.originScale) return;
        latest.current.onTransform(current.instanceId, rotation, scale);
        return;
      }

      // Whole canvas units. The state is written once per gesture, so there is no drift to
      // accumulate, and the sub-unit the rounding drops is 0.16 CSS px in a `classic` preview.
      const x = Math.round(current.x);
      const y = Math.round(current.y);

      if (
        !isStickerOnStrip(current.layout, {
          x,
          y,
          rotation: current.rotation,
          scale: current.scale,
        })
      ) {
        if (selectedRef.current === current.instanceId) select(null);
        latest.current.onRemove(current.instanceId);
        return;
      }
      if (x === current.originX && y === current.originY) return;
      latest.current.onMove(current.instanceId, x, y);
    },
    [cancelFrame, select],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (drag.current) return; // one gesture at a time; a second finger is ignored
      if (!event.isPrimary) return;
      // `button` is 0 for a touch or a pen contact too; anything else is a right/middle click.
      if (event.button !== 0) return;

      const canvas = canvasRef.current;
      const { layout, stickers } = latest.current;
      if (!canvas || !layout) return;

      const point = pointerPoint(event, canvas, layout);
      if (!point) return;

      // The selected sticker's handles first: they sit on its corner or outside its box, often
      // over another sticker, and grabbing the handle is what the user meant.
      const selected = stickers.find((sticker) => sticker.instanceId === selectedRef.current);
      const handle = selected ? hitTestHandle(layout, selected, point) : null;
      const hit = handle && selected ? selected : hitTestStickers(layout, stickers, point);

      if (!hit) {
        // Empty strip under the pointer: drop the selection and leave the event to the page.
        select(null);
        return;
      }

      // Only once something was actually grabbed: no text selection, no native image drag,
      // and on touch no synthetic mouse events afterwards.
      event.preventDefault();
      if (!handle) select(hit.instanceId);

      drag.current = {
        pointerId: event.pointerId,
        instanceId: hit.instanceId,
        gesture: handle ?? 'move',
        layout,
        grabX: hit.x - point.x,
        grabY: hit.y - point.y,
        originX: hit.x,
        originY: hit.y,
        originRotation: hit.rotation,
        originScale: hit.scale,
        startAngle: angleAround(hit, point),
        // Floored so a press dead on the centre cannot divide by zero on the first move.
        startDistance: Math.max(1, distanceFrom(hit, point)),
        x: hit.x,
        y: hit.y,
        rotation: hit.rotation,
        scale: hit.scale,
      };

      // After `drag.current` is set: capture can synchronously fire `gotpointercapture`.
      try {
        canvas.setPointerCapture(event.pointerId);
      } catch {
        // Pointer already gone. The drag still works while the events keep arriving.
      }

      publish();
    },
    [canvasRef, pointerPoint, publish, select],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const current = drag.current;
      if (!current || event.pointerId !== current.pointerId) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const point = pointerPoint(event, canvas, current.layout);
      if (!point) return;

      // Turning and resizing pivot on the centre the gesture started from.
      const centre = { x: current.originX, y: current.originY };

      if (current.gesture === 'rotate') {
        const rotation = normalizeRotation(
          current.originRotation + angleAround(centre, point) - current.startAngle,
        );
        if (rotation === current.rotation) return;
        current.rotation = rotation;
      } else if (current.gesture === 'scale') {
        const scale = clampStickerScale(
          (current.originScale * distanceFrom(centre, point)) / current.startDistance,
        );
        if (scale === current.scale) return;
        current.scale = scale;
      } else {
        const x = point.x + current.grabX;
        const y = point.y + current.grabY;
        if (x === current.x && y === current.y) return;
        current.x = x;
        current.y = y;
      }
      schedule();
    },
    [canvasRef, pointerPoint, schedule],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const current = drag.current;
      if (!current || event.pointerId !== current.pointerId) return;
      finish(true);
    },
    [finish],
  );

  const onPointerCancel = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const current = drag.current;
      if (!current || event.pointerId !== current.pointerId) return;
      finish(false);
    },
    [finish],
  );

  /**
   * Capture taken away without a `pointerup` or a `pointercancel` — the element was removed
   * from the document, or the browser stepped in. Without this the drag would freeze: no
   * further event would ever reach the canvas and the sticker would stay stuck to a pointer
   * that is no longer reporting. It also fires at the end of every normal drag, after
   * `pointerup` has already cleared `drag.current`, which is why it checks.
   */
  const onLostPointerCapture = useCallback(
    (event: Event) => {
      const current = drag.current;
      if (!current) return;
      if ((event as PointerEvent).pointerId !== current.pointerId) return;
      finish(false);
    },
    [finish],
  );

  const unbind = useCallback(() => {
    const canvas = bound.current;
    bound.current = null;
    if (!canvas) return;
    canvas.style.touchAction = boundTouchAction.current;
    canvas.removeEventListener('lostpointercapture', onLostPointerCapture);
  }, [onLostPointerCapture]);

  // No dependency array on purpose, and an identity check inside: the page may mount the
  // `<canvas>` a commit after the hook runs (`useCanvas` has the same problem), and rebinding
  // on every frame of a drag would rewrite an inline style 60 times a second.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas === bound.current) return;

    unbind();
    if (!canvas) return;

    bound.current = canvas;
    boundTouchAction.current = canvas.style.touchAction;
    // A property of the gesture, not of the design: a touch drag on a canvas without this
    // scrolls the page instead, and the `pointermove`s never arrive. Inline so it wins over
    // the stylesheet, and put back on unmount.
    canvas.style.touchAction = 'none';
    canvas.addEventListener('lostpointercapture', onLostPointerCapture);
  });

  useEffect(() => {
    return () => {
      // Unmounted mid-drag: no dispatch into a component that is on its way out, no frame
      // left scheduled, no capture left held, and the inline style handed back.
      drag.current = null;
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = 0;
      unbind();
    };
  }, [unbind]);

  const stickers = useMemo(() => {
    if (!live) return options.stickers;
    return options.stickers.map((sticker) =>
      sticker.instanceId === live.instanceId
        ? { ...sticker, x: live.x, y: live.y, rotation: live.rotation, scale: live.scale }
        : sticker,
    );
  }, [options.stickers, live]);

  // Derived, not synced in an effect: a sticker removed by any route stops being selected
  // on the very render it disappears.
  const liveSelectedId =
    selectedId && options.stickers.some((sticker) => sticker.instanceId === selectedId)
      ? selectedId
      : null;

  return {
    stickers,
    selectedId: liveSelectedId,
    select,
    draggingId: live?.instanceId ?? null,
    willRemove: live ? !live.onStrip : false,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}

/**
 * The horizontal factor is applied to both axes (see `stickerGeometry`), which is only right
 * while the CSS box carries the layout's aspect ratio. When it does not, every sticker is
 * placed at the wrong height and nothing on screen says why — so say it, once per shape.
 */
function warnOnAspectMismatch(
  canvas: HTMLCanvasElement,
  layout: LayoutId,
  warned: RefObject<string>,
): void {
  if (!import.meta.env.DEV) return;

  const cssWidth = canvas.clientWidth;
  const cssHeight = canvas.clientHeight;
  if (cssWidth <= 0 || cssHeight <= 0) return;

  const unit = LAYOUTS[layout].canvas;
  const target = unit.width / unit.height;
  const actual = cssWidth / cssHeight;
  if (Math.abs(actual - target) / target <= ASPECT_TOLERANCE) return;

  const key = `${layout}:${cssWidth}×${cssHeight}`;
  if (key === warned.current) return;
  warned.current = key;
  console.warn(
    `[useStickers] the <canvas> box is ${cssWidth}×${cssHeight} CSS px but "${layout}" is ` +
      `${unit.width}×${unit.height}: stickers will land at the wrong height, because the ` +
      `pointer scale comes from the width alone. Check the aspect-ratio class on the wrapper.`,
  );
}
