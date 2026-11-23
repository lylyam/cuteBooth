/**
 * PhotoFramingModal — the step between picking a file on `/upload` and it landing in its
 * hole: the user drags the photo and zooms it to choose what the hole shows.
 *
 * Copy is invented (no Figma node for this screen yet) and in English like the rest of
 * the product. The viewport has the hole's aspect ratio; the frame chosen later in
 * `/decoration` can trim a little more where its hole is not a rectangle.
 */
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { usePhotoFraming } from '../../hooks/usePhotoFraming';
import { MAX_FRAMING_ZOOM } from '../../utils/imageUtils';
import type { PhotoFraming, Size } from '../../utils/imageUtils';
import styles from './PhotoFramingModal.module.css';

type PhotoFramingModalProps = {
  file: File | null;
  target: Size;
  slotNumber: number;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: (framing: PhotoFraming) => void;
};

function PhotoFramingModal({
  file,
  target,
  slotNumber,
  isSaving,
  onCancel,
  onConfirm,
}: PhotoFramingModalProps) {
  const { status, previewUrl, imageStyle, framing, setZoom, viewportRef, viewportHandlers } =
    usePhotoFraming(file, target);

  const handleClose = () => {
    if (!isSaving) onCancel();
  };

  return (
    <Modal
      isOpen={file !== null}
      onClose={handleClose}
      title={`Fit photo ${slotNumber}`}
      footer={
        <>
          <Button type="button" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => onConfirm(framing)}
            disabled={status !== 'ready' || isSaving}
          >
            {isSaving ? 'Saving…' : 'Use photo'}
          </Button>
        </>
      }
    >
      <div className={styles.framer}>
        <div
          ref={viewportRef}
          className={styles.viewport}
          style={{ aspectRatio: `${target.width} / ${target.height}` }}
          role="group"
          tabIndex={status === 'ready' ? 0 : -1}
          aria-label="Photo position. Drag, or use the arrow keys to move it and + or - to zoom."
          {...viewportHandlers}
        >
          {status === 'ready' && previewUrl && (
            <img
              className={styles.image}
              src={previewUrl}
              alt=""
              draggable={false}
              style={imageStyle}
            />
          )}
          {status === 'loading' && <span className={styles.message}>Loading…</span>}
          {status === 'error' && (
            <span className={styles.message} role="alert">
              We couldn't show that photo.
            </span>
          )}
        </div>

        <label className={styles.zoom}>
          <span>Zoom</span>
          <input
            type="range"
            min={1}
            max={MAX_FRAMING_ZOOM}
            step={0.01}
            value={framing.zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            disabled={status !== 'ready'}
          />
        </label>

        <p className={styles.hint}>Drag the photo to move it. Pinch, scroll or slide to zoom.</p>
      </div>
    </Modal>
  );
}

export default PhotoFramingModal;
