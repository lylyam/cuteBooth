/**
 * usePhotoFraming — lets the user drag and zoom an uploaded photo inside its hole before
 * it is cropped (`/upload`, decision of 2026-11-23: framing happens on upload only, the
 * camera keeps its centred cover crop).
 *
 * Nothing here touches global state. The result is a `PhotoFraming` the page hands to
 * `fileToDataUrl`, so what is stored is still a slot-sized JPEG: persistence, `/review`
 * and the canvas composition are unchanged.
 *
 * The preview is the real file behind an object URL, positioned with percentages computed
 * from `computeFramedRect` — the exact rectangle the crop will use — so what the user sees
 * in the viewport is what lands in the hole.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { CENTERED_FRAMING, clampFraming, computeFramedRect, loadImage } from '../utils/imageUtils';
import type { PhotoFraming, Size } from '../utils/imageUtils';

type LoadedPreview = { file: File; url: string; size: Size };

type DragStart = { x: number; y: number; framing: PhotoFraming; viewport: Size };

type PinchStart = { distance: number; zoom: number };

export type PhotoFramingStatus = 'loading' | 'ready' | 'error';

/** Arrow keys move the crop by this fraction of the room left over. */
const KEY_PAN_STEP = 0.05;
/** `+` / `-` change the zoom by this much. */
const KEY_ZOOM_STEP = 0.1;
/** Wheel sensitivity: one notch (~100 deltaY) is roughly a 10 % zoom. */
const WHEEL_ZOOM_FACTOR = 0.001;

function distanceBetween(points: Iterable<{ x: number; y: number }>): number {
  const [a, b] = [...points];
  if (!a || !b) return 0;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function usePhotoFraming(file: File | null, target: Size) {
  const [preview, setPreview] = useState<LoadedPreview | null>(null);
  const [failedFile, setFailedFile] = useState<File | null>(null);
  const [framing, setFramingState] = useState<PhotoFraming>(CENTERED_FRAMING);
  const [framedFile, setFramedFile] = useState<File | null>(null);

  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const dragStart = useRef<DragStart | null>(null);
  const pinchStart = useRef<PinchStart | null>(null);

  // A new file starts centred. Adjusting state while rendering (instead of in an effect)
  // is React's documented way to reset on a prop change.
  if (file !== framedFile) {
    setFramedFile(file);
    setFramingState(CENTERED_FRAMING);
  }

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    const url = URL.createObjectURL(file);

    loadImage(url)
      .then((image) => {
        if (cancelled) return;
        setPreview({ file, url, size: { width: image.naturalWidth, height: image.naturalHeight } });
      })
      .catch(() => {
        if (!cancelled) setFailedFile(file);
      });

    return () => {
      cancelled = true;
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const ready = preview !== null && preview.file === file ? preview : null;
  const status: PhotoFramingStatus = ready
    ? 'ready'
    : file !== null && failedFile === file
      ? 'error'
      : 'loading';

  const setFraming = useCallback((next: PhotoFraming) => {
    setFramingState(clampFraming(next));
  }, []);

  const setZoom = useCallback((zoom: number) => {
    setFramingState((current) => clampFraming({ ...current, zoom }));
  }, []);

  /** Turns a drag of `dx`,`dy` CSS px into new pan fractions, from where the drag began. */
  const panFromDrag = useCallback(
    (start: DragStart, dx: number, dy: number): PhotoFraming => {
      if (!ready) return start.framing;
      const rect = computeFramedRect(ready.size, target, start.framing);
      const roomX = ready.size.width - rect.sWidth;
      const roomY = ready.size.height - rect.sHeight;
      // Source px per CSS px of the viewport. Dragging right moves the picture right, so
      // the crop window moves left: the pan goes DOWN.
      const scaleX = rect.sWidth / start.viewport.width;
      const scaleY = rect.sHeight / start.viewport.height;
      return clampFraming({
        zoom: start.framing.zoom,
        panX: roomX > 0 ? start.framing.panX - (dx * scaleX) / roomX : start.framing.panX,
        panY: roomY > 0 ? start.framing.panY - (dy * scaleY) / roomY : start.framing.panY,
      });
    },
    [ready, target],
  );

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!ready) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (pointers.current.size === 1) {
      const box = event.currentTarget.getBoundingClientRect();
      dragStart.current = {
        x: event.clientX,
        y: event.clientY,
        framing,
        viewport: { width: box.width, height: box.height },
      };
      pinchStart.current = null;
    } else if (pointers.current.size === 2) {
      dragStart.current = null;
      pinchStart.current = {
        distance: distanceBetween(pointers.current.values()),
        zoom: framing.zoom,
      };
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    const pinch = pinchStart.current;
    if (pinch && pointers.current.size >= 2) {
      const distance = distanceBetween(pointers.current.values());
      if (pinch.distance > 0) setZoom(pinch.zoom * (distance / pinch.distance));
      return;
    }

    const drag = dragStart.current;
    if (drag) {
      setFramingState(panFromDrag(drag, event.clientX - drag.x, event.clientY - drag.y));
    }
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    pinchStart.current = null;
    // Lifting one finger of a pinch hands over to a drag from where the other one is.
    const [remaining] = [...pointers.current.values()];
    if (remaining) {
      const box = event.currentTarget.getBoundingClientRect();
      dragStart.current = {
        x: remaining.x,
        y: remaining.y,
        framing,
        viewport: { width: box.width, height: box.height },
      };
    } else {
      dragStart.current = null;
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, Partial<PhotoFraming>> = {
      ArrowLeft: { panX: framing.panX - KEY_PAN_STEP },
      ArrowRight: { panX: framing.panX + KEY_PAN_STEP },
      ArrowUp: { panY: framing.panY - KEY_PAN_STEP },
      ArrowDown: { panY: framing.panY + KEY_PAN_STEP },
      '+': { zoom: framing.zoom + KEY_ZOOM_STEP },
      '=': { zoom: framing.zoom + KEY_ZOOM_STEP },
      '-': { zoom: framing.zoom - KEY_ZOOM_STEP },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setFraming({ ...framing, ...move });
  };

  // The wheel needs a non-passive native listener: React's `onWheel` cannot preventDefault,
  // and without it zooming the photo also scrolls the page behind the modal.
  useEffect(() => {
    const element = viewportRef.current;
    if (!element || !ready) return;
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      setFramingState((current) =>
        clampFraming({
          ...current,
          zoom: current.zoom * Math.exp(-event.deltaY * WHEEL_ZOOM_FACTOR),
        }),
      );
    };
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [ready]);

  // Percentages of the viewport, which has the hole's aspect ratio: no measuring needed,
  // and the picture stays put if the modal is resized.
  let imageStyle: CSSProperties | undefined;
  if (ready) {
    const rect = computeFramedRect(ready.size, target, framing);
    imageStyle = {
      width: `${(ready.size.width / rect.sWidth) * 100}%`,
      height: `${(ready.size.height / rect.sHeight) * 100}%`,
      left: `${(-rect.sx / rect.sWidth) * 100}%`,
      top: `${(-rect.sy / rect.sHeight) * 100}%`,
    };
  }

  return {
    status,
    previewUrl: ready?.url ?? null,
    imageStyle,
    framing,
    setZoom,
    viewportRef,
    viewportHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
      onKeyDown,
    },
  };
}
