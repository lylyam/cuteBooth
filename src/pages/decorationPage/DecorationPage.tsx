/**
 * DecorationPage — `/decoration`, node U3, Figma 102:319 ("Decorarion"). See
 * specs/decoration.md.
 *
 * One route, three steps (Frames → Backgrounds → Icons). The step is local UI state —
 * it never touches the global reducer, is never persisted and never shows up in the URL.
 * The left panel and the footer buttons are the same across all three steps: only the
 * title and the grid content change, driven by `DecorationPanel` below.
 *
 * The preview is a single `<canvas>` (`useCanvas`, C4) painted straight, with no tilt —
 * unlike `/review` and `/final`, this screen is not `rotation: 'css'`. Stickers are
 * painted by the canvas too (decision 21): there is no DOM layer of draggable handles,
 * so `.stickerLayer`/`.sticker` in `DecorationPage.module.css` are dead CSS this page
 * does not mount.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageShell from '../../components/layouts/PageShell';
import WebAppOldStyle from '../../components/layouts/WebAppOldStyle';
import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import { usePhotoBooth } from '../../context/PhotoBoothContext';
import { useRouteGuard } from '../../hooks/useRouteGuard';
import { useCanvas } from '../../hooks/useCanvas';
import { useStickers } from '../../hooks/useStickers';
import { LAYOUTS } from '../../constants/layouts';
import type { LayoutId } from '../../constants/layouts';
import { FRAMES, getEffectiveFrame } from '../../constants/frames';
import type { FrameDef, FrameId } from '../../constants/frames';
import { backgroundsForLayout } from '../../constants/backgrounds';
import type { BackgroundId } from '../../constants/backgrounds';
import { STICKERS, STICKER_STYLES, STICKER_STYLE_LABELS } from '../../constants/stickers';
import type { StickerId, StickerStyle } from '../../constants/stickers';
import styles from './DecorationPage.module.css';

const STEPS = ['frames', 'backgrounds', 'icons'] as const;
type Step = (typeof STEPS)[number];

// specs/decoration.md "Copy": "Frames" is the only literal from 102:319; the other two
// titles are invented (SUPUESTOS 1).
const PANEL_TITLES: Record<Step, string> = {
  frames: 'Frames',
  backgrounds: 'Backgrounds',
  icons: 'Icons',
};

const PREVIEW_LAYOUT_CLASS: Record<LayoutId, string> = {
  classic: styles.previewClassic,
  wide: styles.previewWide,
  spotlight: styles.previewSpotlight,
};

/**
 * Mirrors `UploadPage`'s `newPhotoId`: no shared id helper exists yet for either
 * caller, and `crypto.randomUUID` needs a secure context.
 */
function newStickerInstanceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sticker-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * A frame's menu swatch — its own SVG cropped to its first hole (`FrameDef.swatch`, in
 * viewBox units; `assets/frames/icons for frames menu/` is unused, per assets.md). The
 * outer `<svg>`'s `viewBox` does the cropping: an SVG root clips to its own viewport by
 * default, so this needs no CSS of its own — `.swatch` only centres and sizes the box.
 */
function FrameSwatchArt({ frame }: { frame: FrameDef }) {
  const { swatch, viewBox, art } = frame;
  return (
    <svg
      viewBox={`${swatch.x} ${swatch.y} ${swatch.width} ${swatch.height}`}
      width="100%"
      height="100%"
      aria-hidden="true"
    >
      <image href={art} x={viewBox.x} y={viewBox.y} width={viewBox.width} height={viewBox.height} />
    </svg>
  );
}

type DecorationPanelProps = {
  step: Step;
  layout: LayoutId;
  frames: FrameDef[];
  effectiveFrameId: FrameId | null;
  onSelectFrame: (frameId: FrameId) => void;
  backgroundId: BackgroundId | null;
  onSelectBackground: (backgroundId: BackgroundId) => void;
  stickerStyle: StickerStyle;
  onStickerStyleChange: (style: StickerStyle) => void;
  onAddSticker: (assetId: StickerId) => void;
};

/**
 * The left panel of all three steps — one component, parameterized by `step`, per
 * specs/decoration.md: "El panel izquierdo ... no cambia entre pasos: cambia el título y
 * el contenido de la rejilla."
 */
function DecorationPanel({
  step,
  layout,
  frames,
  effectiveFrameId,
  onSelectFrame,
  backgroundId,
  onSelectBackground,
  stickerStyle,
  onStickerStyleChange,
  onAddSticker,
}: DecorationPanelProps) {
  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>{PANEL_TITLES[step]}</h2>

      {step === 'icons' && (
        <div className={styles.tabs}>
          {STICKER_STYLES.map((availableStyle) => (
            <button
              key={availableStyle}
              type="button"
              className={`${styles.tab} ${availableStyle === stickerStyle ? styles.tabActive : ''}`.trim()}
              aria-pressed={availableStyle === stickerStyle}
              onClick={() => onStickerStyleChange(availableStyle)}
            >
              {STICKER_STYLE_LABELS[availableStyle]}
            </button>
          ))}
        </div>
      )}

      <div className={styles.grid}>
        {step === 'frames' &&
          frames.map((frame) => (
            <button
              key={frame.id}
              type="button"
              className={`${styles.swatch} ${frame.id === effectiveFrameId ? styles.swatchSelected : ''}`.trim()}
              aria-pressed={frame.id === effectiveFrameId}
              // `frame.name` is already the file stem, e.g. "Frame 7" — do not prefix
              // "Frame" again, or this reads "Frame Frame 7" to a screen reader.
              aria-label={frame.name}
              onClick={() => onSelectFrame(frame.id)}
            >
              <FrameSwatchArt frame={frame} />
            </button>
          ))}

        {step === 'backgrounds' &&
          backgroundsForLayout(layout).map((background) => (
            <button
              key={background.id}
              type="button"
              className={`${styles.swatch} ${styles.backgroundSwatch} ${
                background.id === backgroundId ? styles.swatchSelected : ''
              }`.trim()}
              aria-pressed={background.id === backgroundId}
              aria-label={`Background ${background.name}`}
              onClick={() => onSelectBackground(background.id)}
            >
              <img src={background.src} alt="" />
            </button>
          ))}

        {step === 'icons' &&
          STICKERS[stickerStyle].map((sticker) => (
            <button
              key={sticker.id}
              type="button"
              className={styles.swatch}
              aria-label={`Add sticker ${sticker.name}`}
              onClick={() => onAddSticker(sticker.id)}
            >
              <img src={sticker.src} alt="" />
            </button>
          ))}
      </div>
    </div>
  );
}

function DecorationPage() {
  const navigate = useNavigate();
  const { state, dispatch } = usePhotoBooth();
  const redirect = useRouteGuard('layoutAndPhotos');

  const [step, setStep] = useState<Step>('frames');
  const [stickerStyle, setStickerStyle] = useState<StickerStyle>(STICKER_STYLES[0]);

  // No `rotation` option: unlike /review and /final, this preview is never tilted.
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { draw, isDrawing } = useCanvas(canvasRef);

  const handleMoveSticker = useCallback(
    (instanceId: string, x: number, y: number) => {
      dispatch({ type: 'MOVE_STICKER', instanceId, x, y });
    },
    [dispatch],
  );

  const handleRemoveSticker = useCallback(
    (instanceId: string) => {
      dispatch({ type: 'REMOVE_STICKER', instanceId });
    },
    [dispatch],
  );

  const { stickers, onPointerDown, onPointerMove, onPointerUp, onPointerCancel } = useStickers(
    canvasRef,
    {
      layout: state.selectedLayout,
      stickers: state.stickers,
      onMove: handleMoveSticker,
      onRemove: handleRemoveSticker,
    },
  );

  // `stickers` (from the hook), not `state.stickers`: it is the same array when nothing
  // is being dragged, so this does not loop, and it is what shows the live drag position.
  useEffect(() => {
    void draw({ ...state, stickers });
  }, [draw, state, stickers]);

  if (redirect) return redirect;

  // Guard already sent us to "/" when there is no layout — this fallback only satisfies
  // LAYOUTS's index type, same defensive shape as UploadPage and PhotoResult.
  const layout: LayoutId = state.selectedLayout ?? 'classic';
  const stepIndex = STEPS.indexOf(step);

  // Never highlight `state.frame` directly (frames.ts): it is `null` until the user
  // chooses one, and the canvas already falls back to the layout's plain frame then.
  const effectiveFrame = getEffectiveFrame(state.frame, layout);

  const handleSelectFrame = (frameId: FrameId) => {
    dispatch({ type: 'SET_FRAME', frame: frameId });
  };

  const handleSelectBackground = (backgroundId: BackgroundId) => {
    dispatch({ type: 'SET_BACKGROUND', background: backgroundId });
  };

  const handleAddSticker = (assetId: StickerId) => {
    const canvas = LAYOUTS[layout].canvas;
    dispatch({
      type: 'ADD_STICKER',
      sticker: {
        instanceId: newStickerInstanceId(),
        assetId,
        x: Math.round(canvas.width / 2),
        y: Math.round(canvas.height / 2),
      },
    });
  };

  const handlePrevious = () => {
    if (stepIndex === 0) {
      navigate('/review');
      return;
    }
    setStep(STEPS[stepIndex - 1]);
  };

  const handleNext = () => {
    if (stepIndex === STEPS.length - 1) {
      navigate('/final');
      return;
    }
    setStep(STEPS[stepIndex + 1]);
  };

  return (
    <PageShell>
      <WebAppOldStyle contentClassName={styles.windowContent}>
        <div className={styles.layout}>
          <DecorationPanel
            step={step}
            layout={layout}
            frames={FRAMES[layout]}
            effectiveFrameId={effectiveFrame?.id ?? null}
            onSelectFrame={handleSelectFrame}
            backgroundId={state.background}
            onSelectBackground={handleSelectBackground}
            stickerStyle={stickerStyle}
            onStickerStyleChange={setStickerStyle}
            onAddSticker={handleAddSticker}
          />

          <div className={`${styles.preview} ${PREVIEW_LAYOUT_CLASS[layout]}`}>
            {/* Always mounted, per useCanvas's own rule: it is what does the painting.
                The four pointer handlers are useStickers' (C5) whole gesture; onPointerCancel
                is not optional, or a drag that loses capture freezes forever. */}
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              aria-label="Your photo strip"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            />
            {isDrawing && <Loading />}
          </div>
        </div>

        <div className={styles.footerActions}>
          <Button type="button" onClick={handlePrevious}>
            ← Previous step
          </Button>
          <Button type="button" onClick={handleNext}>
            Next step →
          </Button>
        </div>
      </WebAppOldStyle>
    </PageShell>
  );
}

export default DecorationPage;
