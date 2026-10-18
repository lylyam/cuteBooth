/**
 * SelectedPicturesPage — `/review`, node U5, Figma 91:1346. See specs/review.md.
 *
 * The user sees the strip they just shot or uploaded and decides: keep going to
 * `/decoration`, or retake — which now resets the whole session and sends them back to
 * `/layout` to choose again, not just to the four photos.
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
  const { dispatch } = usePhotoBooth();
  const redirect = useRouteGuard('layoutAndPhotos');

  if (redirect) return redirect;

  const handleRetake = () => {
    // specs/review.md (revised): "Retake photos" resets the whole session and sends the
    // user back to `/layout` to choose again — not just the four photos, the layout too.
    // The decoration is lost regardless of what they pick next; that's the accepted
    // trade-off of letting them change layout here.
    //
    // Both updates go through the SAME `startTransition`, deliberately, and now more than
    // ever: `RESET` clears `selectedLayout` as well as `photos`, so after it lands, BOTH
    // conditions of this page's own `'layoutAndPhotos'` guard fail, not just one. React
    // Router wraps its own navigation state in one internally, so calling `dispatch`
    // outside of it makes it the higher-priority update: this page's own guard would then
    // see the reset state on an intermediate render that is still at "/review", fire its
    // own (untransitioned, so higher priority again) redirect to "/", and win the race
    // against this call — "Retake photos" would land on "/" instead of "/layout".
    // Matching the transition on both keeps them one commit, one destination.
    startTransition(() => {
      dispatch({ type: 'RESET' });
      navigate('/layout');
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
