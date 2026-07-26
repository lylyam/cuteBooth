import { useEffect } from 'react';
import type { ReactNode } from 'react';
import Button from './Button';
import styles from './Modal.module.css';

type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  closeAriaLabel?: string;
};

function Modal({ isOpen, onClose, title, children, footer, closeAriaLabel = 'Close' }: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.body}>
          <div className={styles.titleRow}>
            {title && <h2>{title}</h2>}
            <Button type="button" onClick={onClose} aria-label={closeAriaLabel}>
              X
            </Button>
          </div>
          {children && <div className={styles.content}>{children}</div>}
        </div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}

export default Modal;
