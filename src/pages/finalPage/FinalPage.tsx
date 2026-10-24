/**
 * FinalPage — `/final`, node U4, Figma 2074:52. See specs/final.md.
 *
 * The end of the flow: the user downloads their decorated strip, or retakes — which now
 * resets the whole session and sends them back to `/layout` to choose again, losing the
 * decoration (frame, background, stickers) no matter what they pick next.
 */
import { startTransition, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../../components/layouts/PageShell';
import WebAppOldStyle from '../../components/layouts/WebAppOldStyle';
import Button from '../../components/ui/Button';
import PhotoResult from '../../components/result/PhotoResult';
import { usePhotoBooth } from '../../context/PhotoBoothContext';
import { useRouteGuard } from '../../hooks/useRouteGuard';
import { useCanvas } from '../../hooks/useCanvas';
import styles from './FinalPage.module.css';

function FinalPage() {
  const navigate = useNavigate();
  const { state, dispatch } = usePhotoBooth();
  const redirect = useRouteGuard('layoutAndPhotos');

  // This ref is never attached to a <canvas>: PhotoResult owns the on-screen one and
  // draws it itself. `download`/`exportAsBlob` compose to their own offscreen canvas
  // (canvasUtils.exportStripAsBlob) from the `state` passed explicitly below, so this
  // hook instance only needs to exist for its `download` and `isExporting`.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { download, isExporting } = useCanvas(canvasRef);

  if (redirect) return redirect;

  const handleDownload = () => {
    void download(state);
  };

  // Nothing is dispatched: frame, background and stickers stay in state, so
  // `/decoration` reopens with the strip as it was and the user picks up from there.
  const handleBackToDecoration = () => {
    navigate('/decoration');
  };

  const handleRetake = () => {
    // specs/final.md (revised): "Retake" resets the whole session — RESET, not just
    // CLEAR_PHOTOS — and sends the user back to `/layout` to choose again. The decoration
    // (frame, background, stickers) is lost regardless of what they pick next; that's the
    // accepted trade-off of letting them change layout here.
    //
    // Same race as `/review`'s "Retake photos" — dispatch and navigate must land in the
    // SAME startTransition, and now more than ever: `RESET` clears `selectedLayout` as
    // well as `photos`, so after it lands, BOTH conditions of this page's own
    // `'layoutAndPhotos'` guard fail, not just one. React Router wraps its own navigation
    // in one internally; a `dispatch` outside of it would be the higher-priority update,
    // so this page's own guard would see the reset state on an intermediate render that
    // is still at "/final", fire its own (untransitioned, so higher priority again)
    // redirect to "/", and win the race — "Retake" would land on "/" instead of "/layout".
    startTransition(() => {
      dispatch({ type: 'RESET' });
      navigate('/layout');
    });
  };

  return (
    <PageShell>
      <WebAppOldStyle contentClassName={styles.windowContent}>
        <PhotoResult
          title="Here's your decorated strip!"
          subtitle="Download it, or start over to make a new one."
          actions={
            <>
              <Button type="button" onClick={handleDownload} disabled={isExporting}>
                Download
              </Button>
              <Button type="button" onClick={handleBackToDecoration}>
                Back to decoration
              </Button>
              <Button type="button" onClick={handleRetake}>
                Retake
              </Button>
            </>
          }
        />
      </WebAppOldStyle>
    </PageShell>
  );
}

export default FinalPage;
