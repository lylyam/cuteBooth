import type { ReactNode, MouseEventHandler } from 'react';
import Button from './Button';
import styles from './Card.module.css';

type CardProps = {
  image?: ReactNode;
  buttonLabel?: string;
  onButtonClick?: MouseEventHandler<HTMLButtonElement>;
  children?: ReactNode;
};

function Card({ image, buttonLabel, onButtonClick, children }: CardProps) {
  return (
    <div className={styles.card}>
      {image && (
        <div className={styles.imageContainer}>
          {image}
        </div>
      )}
      {children && <div className={styles.content}>{children}</div>}
      {buttonLabel && (
        <Button onClick={onButtonClick}>
          {buttonLabel}
        </Button>
      )}
    </div>
  );
}

export default Card;
