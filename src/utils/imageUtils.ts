/**
 * Image primitives for CuteBooth — node C1.
 *
 * Pure functions, no React, no global state, no geometry of its own: every target size
 * arrives as a parameter so this module never has to know about `constants/layouts.ts`.
 * Consumers: C2 (`canvasUtils`), C3 (`useCamera`), C4 (`useCanvas`), U2 (`/upload`).
 */

/** JPEG quality for every encode in the app. One knob, one place. */
export const JPEG_QUALITY = 0.85;

/** MIME types `/upload` accepts. The `accept` attribute and the validation share this list. */
export const SUPPORTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;

export type SupportedImageType = (typeof SUPPORTED_IMAGE_TYPES)[number];

/** Ready-made value for `<input type="file" accept={...}>` so it cannot drift from the check. */
export const IMAGE_ACCEPT_ATTRIBUTE = SUPPORTED_IMAGE_TYPES.join(',');

export type Size = { width: number; height: number };

/** Source-pixel rectangle for the 9-argument `drawImage`. */
export type CropRect = { sx: number; sy: number; sWidth: number; sHeight: number };

/** Anything `drawImage` accepts and whose intrinsic size we can read. */
export type DrawableImageSource =
  HTMLImageElement | HTMLVideoElement | HTMLCanvasElement | ImageBitmap;

const MAX_SRC_IN_MESSAGE = 80;

/** Keeps a 2 MB data URL out of an error message. */
function describeSrc(src: string): string {
  const oneLine = src.replace(/\s+/g, ' ').trim();
  return oneLine.length > MAX_SRC_IN_MESSAGE ? `${oneLine.slice(0, MAX_SRC_IN_MESSAGE)}…` : oneLine;
}

/**
 * Loads an image (data URL, object URL or bundled asset) and resolves once it is decoded
 * and safe to `drawImage`. Rejects with a readable `Error`; never resolves with a blank
 * image, which is how a half-loaded `drawImage` silently paints nothing.
 *
 * Does not set `crossOrigin`: every source in this app is same-origin or a data URL, so
 * the canvas is never tainted.
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error('Could not load image: empty source.'));
      return;
    }

    const img = new Image();

    img.onload = () => {
      // Best effort: pay the decode cost here instead of inside the first drawImage.
      // `onload` already guarantees the image is usable, so a decode failure is not fatal.
      if (typeof img.decode === 'function') {
        img.decode().then(
          () => resolve(img),
          () => resolve(img),
        );
        return;
      }
      resolve(img);
    };

    img.onerror = () => {
      reject(new Error(`Could not load image: ${describeSrc(src)}`));
    };

    img.src = src;
  });
}

/** `true` only for PNG, JPEG and WEBP. Anything else — HEIC, GIF, PDF, empty type — is `false`. */
export function isSupportedImageType(file: File): boolean {
  const type = file.type.trim().toLowerCase();
  return (SUPPORTED_IMAGE_TYPES as readonly string[]).includes(type);
}

/** Intrinsic pixel size of a drawable source, whatever kind it is. */
export function getSourceSize(source: DrawableImageSource): Size {
  if (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  if (typeof HTMLVideoElement !== 'undefined' && source instanceof HTMLVideoElement) {
    return { width: source.videoWidth, height: source.videoHeight };
  }
  return { width: source.width, height: source.height };
}

/**
 * `cover` crop, centred: the largest centred source rectangle with the target's aspect
 * ratio. Fills the slot with no letterboxing, at the cost of trimming the long side.
 * Sources smaller than the target are upscaled rather than padded — a slot must be full.
 */
export function computeCoverRect(source: Size, target: Size): CropRect {
  assertPositiveSize(source, 'source');
  assertPositiveSize(target, 'target');

  const scale = Math.max(target.width / source.width, target.height / source.height);
  const sWidth = Math.min(source.width, target.width / scale);
  const sHeight = Math.min(source.height, target.height / scale);

  return {
    sx: (source.width - sWidth) / 2,
    sy: (source.height - sHeight) / 2,
    sWidth,
    sHeight,
  };
}

/**
 * Encodes any drawable source as a JPEG data URL of exactly `target` pixels, cover-cropped
 * from the centre. Transparency is flattened onto white, because JPEG has no alpha.
 *
 * This is the shared engine behind `fileToDataUrl` (U2) and the camera capture (C3).
 * It works in image pixels: `devicePixelRatio` belongs to the on-screen canvas (C2/C4).
 */
export function sourceToDataUrl(source: DrawableImageSource, target: Size): string {
  const sourceSize = getSourceSize(source);
  assertPositiveSize(sourceSize, 'source');
  assertPositiveSize(target, 'target');

  const width = Math.max(1, Math.round(target.width));
  const height = Math.max(1, Math.round(target.height));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  try {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) {
      throw new Error('Could not get a 2D canvas context.');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const { sx, sy, sWidth, sHeight } = computeCoverRect(sourceSize, { width, height });
    ctx.drawImage(source, sx, sy, sWidth, sHeight, 0, 0, width, height);

    let dataUrl: string;
    try {
      dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    } catch (cause) {
      throw new Error('Could not encode the image as JPEG.', { cause });
    }

    // Browsers signal failure by returning 'data:,' instead of throwing.
    if (!dataUrl.startsWith('data:image/jpeg')) {
      throw new Error('Could not encode the image as JPEG.');
    }

    return dataUrl;
  } finally {
    // Let the backing store go now instead of waiting for GC (Safari holds on to it).
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * Decodes a `File` off the main thread when the browser allows it, so a 12 MP photo does
 * not freeze the tab. Any object URL created here is revoked on both paths.
 */
async function decodeFile(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // Fall through to the <img> path: some browsers refuse blobs they can still render.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    // Revoking after the load resolves is safe: the image is already decoded.
    return await loadImage(objectUrl);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * `File` → resized JPEG data URL, ready for `Photo.dataUrl`.
 *
 * Rejects — never hangs — on an unsupported type and on a file the browser cannot decode
 * (an iPhone HEIC hits the second case). Both are states the UI paints, not crashes.
 */
export async function fileToDataUrl(file: File, target: Size): Promise<string> {
  if (!isSupportedImageType(file)) {
    throw new Error(`Unsupported image type: ${file.type || 'unknown'}. Use PNG, JPG or WEBP.`);
  }

  let decoded: ImageBitmap | HTMLImageElement;
  try {
    decoded = await decodeFile(file);
  } catch (cause) {
    throw new Error(`Could not read "${file.name}". The file may be corrupt.`, { cause });
  }

  try {
    return sourceToDataUrl(decoded, target);
  } finally {
    if (typeof ImageBitmap !== 'undefined' && decoded instanceof ImageBitmap) {
      decoded.close();
    }
  }
}

/**
 * Data URL → `Blob`, for the download in `/final`. Synchronous on purpose: the caller
 * hands the blob straight to `URL.createObjectURL`, and an await there buys nothing.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  if (!dataUrl.startsWith('data:') || comma === -1) {
    throw new Error('Not a data URL.');
  }

  const header = dataUrl.slice(5, comma);
  const payload = dataUrl.slice(comma + 1);
  const isBase64 = /;base64$/i.test(header);
  const mimeType = header.replace(/;base64$/i, '').split(';')[0] || 'application/octet-stream';

  if (!isBase64) {
    return new Blob([new TextEncoder().encode(decodeURIComponent(payload))], {
      type: mimeType,
    });
  }

  let binary: string;
  try {
    binary = atob(payload);
  } catch (cause) {
    throw new Error('Malformed base64 data URL.', { cause });
  }

  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new Blob([bytes], { type: mimeType });
}

function assertPositiveSize(size: Size, label: string): void {
  const { width, height } = size;
  const valid = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;

  if (!valid) {
    throw new Error(`Invalid ${label} size: ${width}×${height}.`);
  }
}
