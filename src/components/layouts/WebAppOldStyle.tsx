import type { ReactNode } from 'react';
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
  return (
    <section className={`${styles.wrapper} ${className}`.trim()}>
      <header className={styles.topBar}>
        <img className={styles.logo} src={lymLogo} alt="LYM" />
        <button
          type="button"
          className={styles.closeButton}
          onClick={onCloseClick}
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
