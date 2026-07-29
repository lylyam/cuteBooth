/**
 * PhotoResult — the result block shared by `/review` (U5, Figma 91:1346) and `/final`
 * (U4, Figma 2074:52): in Figma the two screens are structurally identical, only the
 * copy and the actions change. So this component owns none of that — it takes it as
 * props and reads the photo strip straight from the global state.
 *
 * Layer note: this is a component, not a hook, so reading `usePhotoBooth()` directly is
 * fine (pages → components → hooks/context, arrows point down). `useCanvas` still gets
 * the state as a plain argument to `draw()`, same as any other caller — see its own
 * header for the three rules that matter (always render the canvas, the CSS box sets
 * the aspect ratio, `draw` never rejects).
 */
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { usePhotoBooth } from '../../context/PhotoBoothContext';
import { useCanvas } from '../../hooks/useCanvas';
import type { LayoutId } from '../../constants/layouts';
import styles from './PhotoResult.module.css';

export type PhotoResultProps = {
  /** The `h1`. Owned by the page — never hardcode a screen's copy in here. */
  title: string;
  /** The paragraph under the title. Same rule: the page decides the words. */
  subtitle: string;
  /** The buttons row. Each page wires its own `onClick`s and passes them in. */
  actions: ReactNode;
};

const STRIP_LAYOUT_CLASS: Record<LayoutId, string> = {
  classic: styles.stripClassic,
  wide: styles.stripWide,
  spotlight: styles.stripSpotlight,
};

function PhotoResult({ title, subtitle, actions }: PhotoResultProps) {
  const { state } = usePhotoBooth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { draw } = useCanvas(canvasRef, { rotation: 'css' });

  // `state` is a new object on every dispatch, so this repaints whenever the photos,
  // frame, background or stickers change, and on nothing else.
  useEffect(() => {
    void draw(state);
  }, [draw, state]);

  const stripLayoutClass = state.selectedLayout
    ? STRIP_LAYOUT_CLASS[state.selectedLayout]
    : STRIP_LAYOUT_CLASS.classic;

  return (
    <div className={styles.layout}>
      <div className={styles.textBlock}>
        <div className={styles.heading}>
          <h1 className={styles.title}>{title}</h1>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        <div className={styles.actions}>{actions}</div>
      </div>

      <div className={styles.stripWrapper}>
        <div className={`${styles.strip} ${stripLayoutClass}`}>
          {/* Always mounted, per useCanvas's own rule: it is what does the painting. */}
          <canvas ref={canvasRef} className={styles.canvas} aria-label="Your photo strip" />
        </div>
      </div>
    </div>
  );
}

export default PhotoResult;
