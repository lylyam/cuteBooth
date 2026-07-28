/**
 * UploadPage — `/upload`, node U2, Figma 91:1168 (classic) · 91:1202 (wide) ·
 * 91:1223 (spotlight). See specs/upload.md.
 *
 * Decision closed 2026-07-26 (specs/upload.md "Comportamiento"): each hole is a
 * button that opens the system file picker — no dropzone, no multi-file input.
 * Clicking a filled hole replaces just that photo. The half-filled strip is
 * LOCAL state: global `state.photos` has no way to represent an empty hole,
 * since its index IS the hole number. It becomes a single `SET_PHOTOS` only
 * when the user presses Continue, which stays visible and disabled until all
 * four holes are full.
 */
import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../../components/layouts/PageShell';
import WebAppOldStyle from '../../components/layouts/WebAppOldStyle';
import Button from '../../components/ui/Button';
import { usePhotoBooth } from '../../context/PhotoBoothContext';
import { useRouteGuard } from '../../hooks/useRouteGuard';
import {
  fileToDataUrl,
  isSupportedImageType,
  IMAGE_ACCEPT_ATTRIBUTE,
} from '../../utils/imageUtils';
import { LAYOUTS } from '../../constants/layouts';
import type { LayoutId } from '../../constants/layouts';
import type { Photo } from '../../types/photobooth';
import styles from './UploadPage.module.css';

const STRIP_LAYOUT_CLASS: Record<LayoutId, string> = {
  classic: styles.classic,
  wide: styles.wide,
  spotlight: styles.spotlight,
};

const EMPTY_SLOTS: readonly (Photo | null)[] = [null, null, null, null];

// Copy is owned by this page, not by imageUtils — see specs/upload.md SUPUESTOS #2
// for the unsupported-type text. The corrupt-file text isn't in the spec; it's
// invented here and declared in the U2 report SUPUESTOS.
const UNSUPPORTED_TYPE_MESSAGE = "That file isn't a photo. Try a PNG, JPG or WEBP.";
const UNREADABLE_FILE_MESSAGE =
  "We couldn't read that photo. It may be corrupted — try a different file.";

/**
 * `crypto.randomUUID` needs a secure context; the fallback keeps ids unique
 * without one. Mirrors `useCamera`'s private helper of the same name — there
 * is no shared id util yet (worth promoting if a third caller shows up).
 */
function newPhotoId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `photo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function isPhoto(slot: Photo | null): slot is Photo {
  return slot !== null;
}

function UploadPage() {
  const navigate = useNavigate();
  const { state, dispatch } = usePhotoBooth();
  const redirect = useRouteGuard('layout');

  const [slots, setSlots] = useState<(Photo | null)[]>(() => [...EMPTY_SLOTS]);
  const [targetIndex, setTargetIndex] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (redirect) return redirect;

  // Guard already sent us to "/" when there is no layout — this fallback only
  // satisfies `LAYOUTS`'s index type, it never actually renders 'classic' for
  // a different layout's flow. Same defensive shape as PhotoResult.
  const layout: LayoutId = state.selectedLayout ?? 'classic';
  const slotGeometry = LAYOUTS[layout].slots;
  const allFilled = slots.every(isPhoto);

  const handleSlotClick = (index: number) => {
    if (isProcessing) return;
    setError(null);
    setTargetIndex(index);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    // The user closed the picker without choosing anything — not an error.
    if (!file || targetIndex === null) return;
    const index = targetIndex;

    if (!isSupportedImageType(file)) {
      setError(UNSUPPORTED_TYPE_MESSAGE);
      setTargetIndex(null);
      return;
    }

    setIsProcessing(true);
    try {
      const dataUrl = await fileToDataUrl(file, slotGeometry[index]);
      setSlots((previous) =>
        previous.map((slot, i) => (i === index ? { id: newPhotoId(), dataUrl } : slot)),
      );
    } catch {
      setError(UNREADABLE_FILE_MESSAGE);
    } finally {
      setIsProcessing(false);
      setTargetIndex(null);
    }
  };

  const handleContinue = () => {
    if (!slots.every(isPhoto)) return;
    dispatch({ type: 'SET_PHOTOS', photos: slots });
    navigate('/review');
  };

  return (
    <PageShell>
      <WebAppOldStyle contentClassName={styles.windowContent}>
        <div className={`${styles.strip} ${STRIP_LAYOUT_CLASS[layout]}`}>
          {slots.map((photo, index) => {
            const isFeatured = layout === 'spotlight' && index === 0;
            const isLoadingThis = isProcessing && targetIndex === index;

            return (
              <button
                key={index}
                type="button"
                className={`${styles.slot} ${isFeatured ? styles.featured : ''}`.trim()}
                onClick={() => handleSlotClick(index)}
                disabled={isProcessing}
                aria-busy={isLoadingThis}
                aria-label={
                  isLoadingThis
                    ? `Loading photo ${index + 1} of 4`
                    : photo
                      ? `Photo ${index + 1} of 4. Tap to replace.`
                      : `Add photo ${index + 1} of 4`
                }
              >
                {photo ? (
                  <img className={styles.slotPhoto} src={photo.dataUrl} alt="" />
                ) : (
                  <span className={styles.slotPlaceholder} aria-hidden="true">
                    {isLoadingThis ? '…' : '+'}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.actions}>
          <Button type="button" disabled={!allFilled || isProcessing} onClick={handleContinue}>
            Continue
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT_ATTRIBUTE}
          className={styles.visuallyHidden}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            void handleFileChange(event);
          }}
        />
      </WebAppOldStyle>
    </PageShell>
  );
}

export default UploadPage;
