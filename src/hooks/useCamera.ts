/**
 * Camera access and the 3-2-1 capture session — node C3. See specs/camera.md.
 *
 * The only place in the app that calls `getUserMedia`. It owns the stream, the countdown
 * and the shutter; it does **not** navigate, does not dispatch, and does not draw on
 * screen. The page renders a `<video>`, hands over the ref, dispatches `ADD_PHOTO` with
 * whatever comes back, and leaves.
 *
 * ```tsx
 * const { videoRef, stream, countdown, error, isStarting, isCapturing, captureWithCountdown } =
 *   useCamera();
 *
 * // The three attributes are not decoration: without `playsInline` iOS Safari takes the
 * // preview fullscreen, and without `muted` autoplay is blocked.
 * <video ref={videoRef} playsInline muted autoPlay className={styles.mirrored} />
 *
 * <button
 *   disabled={isCapturing || stream === null}
 *   onClick={() => {
 *     void captureWithCountdown({
 *       shots: 4,
 *       onPhoto: (photo) => dispatch({ type: 'ADD_PHOTO', photo }),
 *     });
 *   }}
 * >
 *   Start taking photos!!
 * </button>
 * ```
 *
 * ## Lifecycle — who turns the camera off
 *
 * - **On mount** the hook calls `start()` itself, so the preview is live before the user
 *   presses anything (spec, step 1). `isStarting` is true while the permission prompt is
 *   open; that is when the page shows `Loading`.
 * - **On unmount** it stops every track, clears `video.srcObject` and aborts a running
 *   countdown. **The page has to do nothing.** Leaving `/camera` — by navigating to
 *   `/review`, by the guard, by the back button — kills the camera. The one thing the
 *   page must not do is keep the `<video>` (or the stream) alive somewhere else.
 * - `stop()` is exposed for the rare explicit case (an error screen that wants the light
 *   off now). `start()` is exposed to retry after a denied permission, once the user has
 *   fixed it in the browser. Calling `start()` on a live stream is a no-op.
 *
 * ## What it protects against
 *
 * - Unmounting while `getUserMedia` is still pending: the stream that arrives late is
 *   stopped on arrival instead of leaking a lit camera with no UI attached.
 * - Unmounting mid-countdown: the session is aborted, the timer cleared, and no `setState`
 *   runs afterwards.
 * - A camera yanked away mid-session (unplugged, permission revoked, another app grabs
 *   it): the `ended` track event becomes an `error`, not a frozen preview.
 * - Blocked autoplay: `play()` is retried from inside the click, which is a user gesture.
 * - A denied permission is a **state**, never a thrown error. `captureWithCountdown` never
 *   rejects either: it resolves with fewer photos than asked and leaves `error` set.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { LAYOUTS } from '../constants/layouts';
import type { LayoutId, Slot } from '../constants/layouts';
import { usePhotoBooth } from '../context/PhotoBoothContext';
import type { Photo } from '../types/photobooth';
import { sourceToDataUrl } from '../utils/imageUtils';
import type { Size } from '../utils/imageUtils';

/** Seconds shown before each shot: 3, 2, 1, flash. */
export const COUNTDOWN_SECONDS = 3;

/** One countdown step. */
const COUNTDOWN_TICK_MS = 1000;

/** Breather between two shots of the same session, so nobody is caught mid-blink. */
const SHOT_GAP_MS = 800;

/** How long a shot waits for a decodable video frame before giving up. */
const FRAME_TIMEOUT_MS = 2000;

/** Poll step while waiting for that frame. */
const FRAME_POLL_MS = 50;

/**
 * The saved photo is mirrored, like the preview. Spec supuesto 2: a photobooth shows you
 * your reflection, and a capture that comes back unflipped reads as somebody else's photo.
 * Flip this one flag to change both the intent and the pixels — the CSS mirror of the
 * preview lives in `CameraPage.module.css` (D3) and has to agree with it.
 */
const MIRROR_CAPTURE = true;

/**
 * `ideal`, never `exact`: a 640×480 webcam still works, it just gives less to crop from.
 * 1080p because the biggest slot in the app is `spotlight`'s hero at 1266×738 export px,
 * and 720p would already be upscaling it.
 */
const PREFERRED_CONSTRAINTS: MediaStreamConstraints = {
  // A photobooth records no sound: asking for audio would add a second permission prompt
  // and a mic indicator for nothing.
  audio: false,
  video: {
    facingMode: { ideal: 'user' },
    width: { ideal: 1920 },
    height: { ideal: 1080 },
  },
};

/** Number of photos a strip holds. Comes from the geometry, not from a loose 4. */
const SLOT_COUNT = LAYOUTS.classic.slots.length;

/** Fallback capture size when no layout is selected — the biggest slot in the app. */
const LARGEST_SLOT: Slot = Object.values(LAYOUTS)
  .flatMap((layout) => layout.slots)
  .reduce((biggest, slot) =>
    slot.width * slot.height > biggest.width * biggest.height ? slot : biggest,
  );

/**
 * Why the camera is not available. The page paints the copy it wants; `message` is a
 * readable English default so no screen is ever blank.
 *
 * The distinction that matters is `denied` (the user can fix it) versus everything else
 * (the user cannot) — spec: denied offers the browser permission, the rest offer
 * `/upload`.
 */
export type CameraErrorKind =
  | 'denied' // NotAllowedError — permission refused or dismissed
  | 'not-found' // NotFoundError — no camera on this device
  | 'in-use' // NotReadableError — another app holds the device
  | 'insecure' // page served over plain http, where getUserMedia does not exist
  | 'unsupported' // browser without mediaDevices at all
  | 'ended' // the camera went away after it had started
  | 'capture' // the stream is fine, the shot is not
  | 'unknown';

export type CameraError = { kind: CameraErrorKind; message: string };

export type CaptureOptions = {
  /** Shots in this session, 1 by default. Clamped to the free slots left in the strip. */
  shots?: number;
  /**
   * Fired after each shot, so `/camera` can `ADD_PHOTO` one at a time instead of waiting
   * for the whole session. `index` is the slot the photo belongs to.
   */
  onPhoto?: (photo: Photo, index: number) => void;
};

export type UseCameraResult = {
  /** Attach to the `<video>`. The hook sets `srcObject`, `muted` and `playsInline` on it. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** The live stream, or `null` when it is starting, stopped or failed. */
  stream: MediaStream | null;
  /** 3, 2, 1 during a shot; `null` while idle, between shots and at the moment of firing. */
  countdown: number | null;
  /** A state to paint, not an exception to catch. */
  error: CameraError | null;
  /** `getUserMedia` is pending — the permission prompt may be open. Show `Loading`. */
  isStarting: boolean;
  /** A session is running. Disable the button with this, not with `countdown !== null`. */
  isCapturing: boolean;
  /** Idempotent: a no-op while a stream is already live. Never rejects. */
  start: () => Promise<void>;
  /** Cuts the tracks now. The unmount does this on its own. */
  stop: () => void;
  /** Runs a session of `shots` countdowns. Never rejects; resolves with what it got. */
  captureWithCountdown: (options?: CaptureOptions) => Promise<Photo[]>;
};

const MESSAGES: Record<CameraErrorKind, string> = {
  // Literal from specs/camera.md, supuesto 3.
  denied: "We can't reach your camera. Check the browser permission, or upload photos instead.",
  'not-found': "We couldn't find a camera on this device. You can upload photos instead.",
  'in-use': 'Your camera is busy in another app. Close it and try again, or upload photos instead.',
  insecure: 'The camera needs a secure connection. You can upload photos instead.',
  unsupported: "This browser can't open the camera. You can upload photos instead.",
  ended: 'Your camera turned off. Try again, or upload photos instead.',
  capture: "We couldn't take that photo. Try again, or upload photos instead.",
  unknown: 'Something went wrong with your camera. Try again, or upload photos instead.',
};

function cameraError(kind: CameraErrorKind): CameraError {
  return { kind, message: MESSAGES[kind] };
}

export function useCamera(): UseCameraResult {
  const { state } = usePhotoBooth();
  const { selectedLayout } = state;
  const photoCount = state.photos.length;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState<CameraError | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);

  // `stream` also lives in a ref: `stop()` and the unmount cleanup must see the current
  // stream without being re-created on every render, or the cleanup closes over a stale one.
  const streamRef = useRef<MediaStream | null>(null);
  // False from the moment the cleanup runs. Every setState past that point is skipped.
  const aliveRef = useRef(true);
  // Bumped by every start() and stop(). A getUserMedia that resolves with a stale
  // generation belongs to a component that is already gone: stop it, don't show it.
  const generationRef = useRef(0);
  // Aborts the countdown of the running session.
  const sessionRef = useRef<AbortController | null>(null);
  const capturingRef = useRef(false);

  /** Drops the stream and everything hanging off it. Does not touch `error`. */
  const release = useCallback((): void => {
    sessionRef.current?.abort();
    sessionRef.current = null;
    capturingRef.current = false;

    const current = streamRef.current;
    streamRef.current = null;
    stopTracks(current);

    const video = videoRef.current;
    if (video) {
      // Without this the element keeps a reference to a dead stream and holds its last frame.
      video.srcObject = null;
    }

    if (aliveRef.current) {
      setStream(null);
      setCountdown(null);
      setIsCapturing(false);
      setIsStarting(false);
    }
  }, []);

  const stop = useCallback((): void => {
    // Invalidate any getUserMedia still in flight, so its stream is stopped on arrival.
    generationRef.current += 1;
    release();
  }, [release]);

  const start = useCallback(async (): Promise<void> => {
    if (streamRef.current) return; // already live

    const devices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
    if (!devices || typeof devices.getUserMedia !== 'function') {
      // On plain http `navigator.mediaDevices` is simply absent. That is not a bug in the
      // browser and not one in this app either, so it gets its own message.
      const insecure = typeof window !== 'undefined' && window.isSecureContext === false;
      setError(cameraError(insecure ? 'insecure' : 'unsupported'));
      return;
    }

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    setIsStarting(true);
    setError(null);

    let next: MediaStream;
    try {
      next = await requestStream(devices);
    } catch (cause) {
      // The prompt can outlive the page: only the current generation may paint.
      if (!aliveRef.current || generation !== generationRef.current) return;
      setIsStarting(false);
      setError(toCameraError(cause));
      return;
    }

    if (!aliveRef.current || generation !== generationRef.current) {
      // Unmounted (or stopped, or restarted) while the user was answering the prompt.
      // Nobody will ever see this stream, and nothing else will ever stop it.
      stopTracks(next);
      return;
    }

    for (const track of next.getTracks()) {
      track.addEventListener(
        'ended',
        () => {
          if (!aliveRef.current || generation !== generationRef.current) return;
          release();
          setError(cameraError('ended'));
        },
        { once: true },
      );
    }

    streamRef.current = next;
    setStream(next);
    setIsStarting(false);
  }, [release]);

  // Start on mount, and — the expensive one to get wrong — stop on unmount, always.
  useEffect(() => {
    aliveRef.current = true; // StrictMode remounts the effect; re-arm the guard.
    void start();

    return () => {
      aliveRef.current = false;
      stop();
    };
  }, [start, stop]);

  // Attaching is idempotent and runs after every commit on purpose: the page may mount the
  // <video> a render later than the stream arrives (it shows Loading first), and a
  // [stream]-keyed effect would have already run by then and never fire again.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!stream) {
      if (video.srcObject) video.srcObject = null;
      return;
    }
    if (video.srcObject === stream) return;

    video.srcObject = stream;
    // Belt and braces over the JSX attributes: iOS Safari sends an un-inlined video
    // fullscreen, and an unmuted one is not allowed to autoplay at all.
    video.muted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', 'true');

    void play(video);
  });

  const captureWithCountdown = useCallback(
    async (options?: CaptureOptions): Promise<Photo[]> => {
      if (capturingRef.current) return []; // one session at a time
      const video = videoRef.current;
      if (!video || !streamRef.current) return []; // no preview: `error` already says why

      const firstSlot = Math.min(photoCount, SLOT_COUNT);
      const free = SLOT_COUNT - firstSlot;
      const wanted = Math.trunc(options?.shots ?? 1);
      const shots = Math.min(Math.max(wanted, 0), free);
      if (shots < 1) return [];

      const controller = new AbortController();
      const { signal } = controller;
      sessionRef.current = controller;
      capturingRef.current = true;
      setIsCapturing(true);

      const tick = (value: number | null): void => {
        if (aliveRef.current && !signal.aborted) setCountdown(value);
      };

      const taken: Photo[] = [];
      try {
        // Autoplay may have been refused before any gesture. This call is inside one.
        await play(video);

        for (let shot = 0; shot < shots; shot += 1) {
          if (shot > 0 && !(await wait(SHOT_GAP_MS, signal))) break;
          if (!(await runCountdown(tick, signal))) break;

          if (!(await waitForFrame(video, signal))) {
            if (aliveRef.current && !signal.aborted) setError(cameraError('capture'));
            break;
          }

          let photo: Photo;
          try {
            photo = {
              id: newPhotoId(),
              dataUrl: grabFrame(video, captureTarget(selectedLayout, firstSlot + shot)),
            };
          } catch {
            if (aliveRef.current && !signal.aborted) setError(cameraError('capture'));
            break;
          }

          // Aborted while the JPEG was being encoded: this photo belongs to a session
          // that no longer exists, so it is not handed to anyone.
          if (signal.aborted) break;

          taken.push(photo);
          options?.onPhoto?.(photo, firstSlot + shot);
        }
      } finally {
        if (sessionRef.current === controller) sessionRef.current = null;
        capturingRef.current = false;
        if (aliveRef.current) {
          setCountdown(null);
          setIsCapturing(false);
        }
      }

      return taken;
    },
    [photoCount, selectedLayout],
  );

  return {
    videoRef,
    stream,
    countdown,
    error,
    isStarting,
    isCapturing,
    start,
    stop,
    captureWithCountdown,
  };
}

/** The camera light stays on until every track is stopped — one per track, no exceptions. */
function stopTracks(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

async function requestStream(devices: MediaDevices): Promise<MediaStream> {
  try {
    return await devices.getUserMedia(PREFERRED_CONSTRAINTS);
  } catch (cause) {
    // Some devices reject a resolution hint outright instead of picking the nearest mode.
    // A plain `video: true` is better than no camera at all.
    if (cause instanceof Error && cause.name === 'OverconstrainedError') {
      return await devices.getUserMedia({ video: true, audio: false });
    }
    throw cause;
  }
}

function toCameraError(cause: unknown): CameraError {
  const name = cause instanceof Error ? cause.name : '';

  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return cameraError('denied');
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return cameraError('not-found');
    case 'NotReadableError':
    case 'TrackStartError':
      return cameraError('in-use');
    default:
      return cameraError('unknown');
  }
}

/** `play()` returns a promise that rejects when autoplay is blocked. Unhandled, it warns. */
async function play(video: HTMLVideoElement): Promise<void> {
  try {
    await video.play();
  } catch {
    // Blocked, or interrupted by a new load. The preview stays on its current frame and
    // the next user gesture retries; drawImage works on a paused video anyway.
  }
}

/** Resolves `true` when the delay ran out, `false` the moment the session was aborted. */
function wait(ms: number, signal: AbortSignal): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    if (signal.aborted) {
      resolve(false);
      return;
    }

    let timer = 0;
    const onAbort = (): void => {
      window.clearTimeout(timer);
      resolve(false);
    };

    timer = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve(true);
    }, ms);

    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/** 3, 2, 1 — one second each. `false` if the component died before the shutter. */
async function runCountdown(
  tick: (value: number | null) => void,
  signal: AbortSignal,
): Promise<boolean> {
  for (let value = COUNTDOWN_SECONDS; value >= 1; value -= 1) {
    if (signal.aborted) return false;
    tick(value);
    if (!(await wait(COUNTDOWN_TICK_MS, signal))) return false;
  }

  tick(null);
  return !signal.aborted;
}

/**
 * A `drawImage` from a video with no decoded frame paints nothing at all — no error, no
 * warning, a blank photo. Three seconds of countdown make this all but impossible; the
 * exception is a stream that arrives right as the button is pressed.
 */
async function waitForFrame(video: HTMLVideoElement, signal: AbortSignal): Promise<boolean> {
  const ready = (): boolean =>
    video.readyState >= 2 /* HAVE_CURRENT_DATA */ && video.videoWidth > 0 && video.videoHeight > 0;

  const deadline = Date.now() + FRAME_TIMEOUT_MS;
  while (!ready()) {
    if (signal.aborted || Date.now() >= deadline) return false;
    if (!(await wait(FRAME_POLL_MS, signal))) return false;
  }

  return true;
}

/**
 * The slot this photo is going to end up in, so the capture and the composition agree on
 * the aspect ratio and the strip never crops twice. Sizes are already multiplied by
 * `EXPORT_SCALE`, which is what makes 402×285 (a `spotlight` thumbnail) the right amount
 * of pixels rather than a stingy one.
 */
function captureTarget(layout: LayoutId | null, index: number): Size {
  if (!layout) return { width: LARGEST_SLOT.width, height: LARGEST_SLOT.height };

  const { slots } = LAYOUTS[layout];
  const slot = slots[Math.min(Math.max(index, 0), slots.length - 1)];
  return { width: slot.width, height: slot.height };
}

/**
 * Current video frame → JPEG data URL of exactly `target` pixels.
 *
 * The mirroring is why there is an intermediate canvas: `sourceToDataUrl` (C1) crops and
 * encodes but does not flip, and flipping is a property of the capture, not of the crop.
 * The buffer is at native video resolution so the flip costs no quality, and C1 does the
 * one resize.
 */
function grabFrame(video: HTMLVideoElement, target: Size): string {
  if (!MIRROR_CAPTURE) return sourceToDataUrl(video, target);

  const width = video.videoWidth;
  const height = video.videoHeight;
  const buffer = document.createElement('canvas');
  buffer.width = width;
  buffer.height = height;

  try {
    const context = buffer.getContext('2d', { alpha: false });
    if (!context) throw new Error('Could not get a 2D canvas context.');

    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, width, height);

    return sourceToDataUrl(buffer, target);
  } finally {
    // Release the backing store now instead of at the next GC (Safari holds on to it).
    buffer.width = 0;
    buffer.height = 0;
  }
}

/** `crypto.randomUUID` needs a secure context; the fallback keeps ids unique without one. */
function newPhotoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
