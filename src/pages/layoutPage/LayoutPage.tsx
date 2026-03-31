
import PageShell from '../../components/layouts/PageShell';
import styles from './LayoutPage.module.css';

function LayoutPage() {
  return (
    <PageShell>
      <section className={styles.content}>
        <h1>Layout Page</h1>
      </section>
    </PageShell>
  );
}
export default LayoutPage;