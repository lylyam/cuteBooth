import type { ReactNode } from 'react';
import AppFooter from './AppFooter';
import styles from './PageShell.module.css';

type PageShellProps = {
  children: ReactNode;
  contentClassName?: string;
};

function PageShell({ children, contentClassName = '' }: PageShellProps) {
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <main className={`${styles.main} ${contentClassName}`.trim()}>{children}</main>
        <AppFooter />
      </div>
    </div>
  );
}

export default PageShell;