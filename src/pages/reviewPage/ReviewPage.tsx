/**
 * SelectedPicturesPage — `/review`, node U5, Figma 91:1346. See specs/review.md.
 *
 * The user sees the strip they just shot or uploaded and decides: keep going to
 * `/decoration`, or retake the four photos (back to wherever they came from).
 */
import { startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../../components/layouts/PageShell';
import WebAppOldStyle from '../../components/layouts/WebAppOldStyle';
import Button from '../../components/ui/Button';
import PhotoResult from '../../components/result/PhotoResult';
import { usePhotoBooth } from '../../context/PhotoBoothContext';
import { useRouteGuard } from '../../hooks/useRouteGuard';
import styles from './ReviewPage.module.css';

function ReviewPage() {
  const navigate = useNavigate();
  const { state, dispatch } = usePhotoBooth();
  const redirect = useRouteGuard('layoutAndPhotos');

  if (redirect) return redirect;

  const handleRetake = () => {
    // specs/review.md: repeat all four, don't ask for layout or source again.
    //
    // Both updates go through the SAME `startTransition`, deliberately. React
    // Router wraps its own navigation state in one internally, so calling
    // `dispatch` outside of it makes it the higher-priority update: this page's
    // own guard would then see `photos.length === 0` on an intermediate render
    // that is still at "/review", fire its own (untransitioned, so higher
    // priority again) redirect to "/", and win the race against this call —
    // "Retake photos" would land on "/" instead of the source page. Matching
    // the transition on both keeps them one commit, one destination.
    startTransition(() => {
      dispatch({ type: 'CLEAR_PHOTOS' });
      navigate(state.source === 'camera' ? '/camera' : '/upload');
    });
  };

  const handleStartDecorating = () => {
    navigate('/decoration');
  };

  return (
    <PageShell>
      <WebAppOldStyle contentClassName={styles.windowContent}>
        <PhotoResult
          title="Here's your photo strip!"
          subtitle="Happy with it or want to try again?"
          actions={
            <>
              <Button type="button" onClick={handleRetake}>
                Retake photos
              </Button>
              <Button type="button" onClick={handleStartDecorating}>
                Start decorating
              </Button>
            </>
          }
        />
      </WebAppOldStyle>
    </PageShell>
  );
}

export default ReviewPage;
