/**
 * CameraPage — `/camera`, node U1, Figma 91:954. See specs/camera.md.
 *
 * The user shoots the four photos of the strip with their device's camera. `useCamera`
 * (C3) owns the stream, the 3-2-1 countdown and the shutter; this page only renders the
 * `<video>`, reacts to `state.photos.length` to hand off to `/review`, and owns the copy
 * for whatever `error.kind` the hook reports (its own default messages are ignored on
 * purpose — see the U1 report).
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../../components/layouts/PageShell';
import WebAppOldStyle from '../../components/layouts/WebAppOldStyle';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import { usePhotoBooth } from '../../context/PhotoBoothContext';
import { useRouteGuard } from '../../hooks/useRouteGuard';
import { useCamera } from '../../hooks/useCamera';
import type { CameraErrorKind } from '../../hooks/useCamera';
import cameraIcon from '../../assets/camera.svg';
import styles from './CameraPage.module.css';

// Copy is owned by this page, not by `useCamera` — see specs/camera.md SUPUESTO 3 for the
// `denied` text (literal from the spec). The other kinds aren't covered by the spec; the
// lines below are written here and declared as SUPUESTOS in the U1 report.
const ERROR_MESSAGES: Record<CameraErrorKind, string> = {
  denied: "We can't reach your camera. Check the browser permission, or upload photos instead.",
  'not-found': "We couldn't find a camera on this device. Upload your photos instead.",
  'in-use':
    'Your camera is being used by another app. Close it and try again, or upload your photos instead.',
  insecure: 'Camera access needs a secure connection. Upload your photos instead.',
  unsupported: "This browser can't open your camera. Upload your photos instead.",
  ended: 'Your camera turned off unexpectedly. Upload your photos instead.',
  capture: "That shot didn't come through — press Start taking photos!! to try again.",
  unknown: 'Something went wrong with your camera. Upload your photos instead.',
};

/** Shots in a strip — one progress dot each. */
const SHOT_COUNT = 4;

/**
 * Length of the shutter flash. The page owns it, not the CSS, because the last shot has to
 * wait it out: `/review` is pushed this long after the fourth photo, or that flash would
 * never be seen.
 */
const FLASH_MS = 450;

function CameraPage() {
  const navigate = useNavigate();
  const { state, dispatch } = usePhotoBooth();
  const redirect = useRouteGuard('layout');

  const { videoRef, stream, countdown, error, isStarting, isCapturing, captureWithCountdown } =
    useCamera();

  const photoCount = state.photos.length;
  // The shot that comes next, 1-based; with the strip full, the last one stays lit.
  const currentShot = Math.min(photoCount + 1, SHOT_COUNT);

  // One flash per photo: a new `key` remounts the overlay, which replays its animation.
  const [flashCount, setFlashCount] = useState(0);

  // specs/camera.md: "Sale a /review en cuanto photos.length === 4. Automático." Driven
  // by the committed state rather than threaded through the capture callback, so it can't
  // race this page's own guard (which doesn't care about `photos` anyway — see DAG.md
  // LECCIONES §4, the race that bit U5's "Retake").
  // The hand-off waits `FLASH_MS` so the fourth flash plays out first.
  useEffect(() => {
    if (photoCount !== SHOT_COUNT) return;
    const timer = window.setTimeout(() => navigate('/review'), FLASH_MS);
    return () => window.clearTimeout(timer);
  }, [photoCount, navigate]);

  if (redirect) return redirect;

  // `capture` is the one non-fatal kind: a single bad shot doesn't kill the stream, so the
  // preview stays live and the button stays "Start taking photos!!". Every other kind means
  // there is no camera to show.
  const isFatalError = error !== null && stream === null;

  const handleStart = () => {
    void captureWithCountdown({
      shots: SHOT_COUNT,
      onPhoto: (photo) => {
        dispatch({ type: 'ADD_PHOTO', photo });
        setFlashCount((count) => count + 1);
      },
    });
  };

  const handleGoToUpload = () => {
    dispatch({ type: 'SET_SOURCE', source: 'upload' });
    navigate('/upload');
  };

  return (
    <PageShell>
      <WebAppOldStyle contentClassName={styles.windowContent}>
        <img className={styles.icon} src={cameraIcon} alt="" />

        <div className={styles.preview}>
          <div className={styles.previewBox}>
            <video
              ref={videoRef}
              className={styles.previewVideo}
              playsInline
              muted
              autoPlay
              aria-label="Live preview from your camera"
            />

            <span className={styles.countdown} aria-live="polite" aria-atomic="true">
              {countdown ?? ''}
            </span>

            {flashCount > 0 && (
              <span
                key={flashCount}
                className={styles.flash}
                style={{ animationDuration: `${FLASH_MS}ms` }}
                aria-hidden="true"
              />
            )}

            {isStarting && <Loading />}
          </div>

          {!isFatalError && (
            <ol className={styles.progress} aria-label={`Photo ${currentShot} of ${SHOT_COUNT}`}>
              {Array.from({ length: SHOT_COUNT }, (_, index) => (
                <li
                  key={index}
                  className={`${styles.progressDot} ${
                    index < currentShot ? styles.progressDotFilled : ''
                  }`.trim()}
                />
              ))}
            </ol>
          )}
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {ERROR_MESSAGES[error.kind]}
          </p>
        )}

        {isFatalError ? (
          <Button type="button" onClick={handleGoToUpload}>
            Upload photos instead
          </Button>
        ) : (
          <Button type="button" disabled={isCapturing || stream === null} onClick={handleStart}>
            Start taking photos!!
          </Button>
        )}
      </WebAppOldStyle>
    </PageShell>
  );
}

export default CameraPage;
