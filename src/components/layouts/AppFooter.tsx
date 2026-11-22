import styles from './AppFooter.module.css';

/**
 * Where "A Lym's project" points. `null` until there is a page to link to: the credit renders
 * as plain text, and setting a URL here is the whole change to turn it into a link.
 */
const PROJECT_URL: string | null = null;

const CREDIT = "A Lym's project";

function AppFooter() {
  return (
    <footer className={styles.footer}>
      {PROJECT_URL ? (
        <a className={styles.text} href={PROJECT_URL} target="_blank" rel="noopener noreferrer">
          {CREDIT}
        </a>
      ) : (
        <span className={styles.text}>{CREDIT}</span>
      )}
    </footer>
  );
}

export default AppFooter;
