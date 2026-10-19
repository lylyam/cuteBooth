import { startTransition } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePhotoBooth } from '../../context/PhotoBoothContext';
import lymLogo from '../../assets/LYMlogo.png';
import styles from './WebAppOldStyle.module.css';

type WebAppOldStyleProps = {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  onCloseClick?: () => void;
  closeAriaLabel?: string;
};

function WebAppOldStyle({
  children,
  className = '',
  contentClassName = '',
  onCloseClick,
  closeAriaLabel = 'Close panel',
}: WebAppOldStyleProps) {
  const navigate = useNavigate();
  const { dispatch } = usePhotoBooth();

  // Closing the window ends the session and goes home. RESET and not just a navigate: with
  // four photos still in state, `/camera` would bounce straight to `/review` on the next
  // visit. Same startTransition as Retake (LECCIONES §4): one commit, one destination.
  const handleClose = () => {
    startTransition(() => {
      dispatch({ type: 'RESET' });
      navigate('/');
    });
  };

  return (
    <section className={`${styles.wrapper} ${className}`.trim()}>
      <header className={styles.topBar}>
        <img className={styles.logo} src={lymLogo} alt="LYM" />
        <button
          type="button"
          className={styles.closeButton}
          onClick={onCloseClick ?? handleClose}
          aria-label={closeAriaLabel}
        >
          x
        </button>
      </header>

      <div className={`${styles.content} ${contentClassName}`.trim()}>{children}</div>
    </section>
  );
}

export default WebAppOldStyle;
