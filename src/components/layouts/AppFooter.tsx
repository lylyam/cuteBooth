import { Link } from 'react-router-dom';
import styles from './AppFooter.module.css';

function AppFooter() {
  return (
    <footer className={styles.footer}>
      <div className={styles.links}>
        <Link to="/about">About Lym</Link>
        <Link to="/privacy">Privacy Policy</Link>
      </div>
      <span className={styles.text}>A Lym&apos;s project</span>
    </footer>
  );
}

export default AppFooter;
