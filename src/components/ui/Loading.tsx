import styles from './Loading.module.css';

type LoadingProps = {
  /**
   * Visible label under the spinner (Figma's `91:1283` draws no text — see
   * SUPUESTOS in the C7 report). When omitted, the spinner still exposes
   * `fallbackLabel` to assistive tech via `aria-label`, it just isn't painted.
   */
  label?: string;
  /** Accessible name used when `label` is not provided. Defaults to "Loading". */
  fallbackLabel?: string;
};

/**
 * Overlay spinner shown while a screen is waiting on something (decoding an
 * upload, composing the strip, loading the decoration panel's art).
 *
 * `.overlay` is `position: absolute; inset: 0` — it anchors to its nearest
 * positioned ancestor, not the viewport. The element that mounts `Loading`
 * MUST be `position: relative` (or already positioned), otherwise the overlay
 * escapes to cover the whole page instead of just that container.
 */
function Loading({ label, fallbackLabel = 'Loading' }: LoadingProps) {
  return (
    <div
      className={styles.overlay}
      role="status"
      aria-live="polite"
      aria-label={label ?? fallbackLabel}
    >
      <div className={styles.spinner} aria-hidden="true" />
      {label && <p className={styles.label}>{label}</p>}
    </div>
  );
}

export default Loading;
