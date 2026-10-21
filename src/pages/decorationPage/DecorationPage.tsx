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
 * painted by the canvas too (decision 21): this page mounts no DOM layer of draggable
 * handles on top of it. See specs/decoration.md §3.2.
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
import ColorWheel from '../../components/ui/ColorWheel';
import {
  BACKGROUND_LIST,
  DEFAULT_SOLID_COLOR,
  resolveBackground,
  toSolidColor,
  UPLOADED_BACKGROUND,
} from '../../constants/backgrounds';
import type { BackgroundChoice, BackgroundId, SolidColor } from '../../constants/backgrounds';
import {
  IMAGE_ACCEPT_ATTRIBUTE,
  fileToDataUrl,
  isSupportedImageType,
} from '../../utils/imageUtils';
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

// Same words as /upload's, for the same two failures (UploadPage.tsx): a background the
// user brings is read with the same `fileToDataUrl` and fails the same way.
const UNSUPPORTED_TYPE_MESSAGE = "That file isn't a photo. Try a PNG, JPG or WEBP.";
const UNREADABLE_FILE_MESSAGE =
  "We couldn't read that photo. It may be corrupted — try a different file.";

/** Ties the disabled `Next step` of step 2 to the line that explains it. */
const BACKGROUND_HINT_ID = 'decoration-background-hint';

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
 * A frame's menu swatch — its own SVG cropped to one of its holes (`FrameDef.swatch`, in
 * viewBox units; `assets/frames/icons for frames menu/` is unused, per assets.md).
 *
 * The outer `<svg>` scales the window to the cell; the inner one crops to it. The root
 * alone is not enough: it clips to its *viewport*, and when the cell's aspect differs from
 * the window's — `spotlight`'s big hole is wider than `.swatch`'s 172/121 — `meet`
 * letterboxes and the neighbouring holes show above and below. A nested `<svg>` clips to
 * exactly its `x y width height`, whatever the cell. `.swatch` only centres and sizes the box.
 */
function FrameSwatchArt({ frame }: { frame: FrameDef }) {
  const { swatch, viewBox, art } = frame;
  const crop = `${swatch.x} ${swatch.y} ${swatch.width} ${swatch.height}`;
  return (
    <svg viewBox={crop} width="100%" height="100%" aria-hidden="true">
      <svg x={swatch.x} y={swatch.y} width={swatch.width} height={swatch.height} viewBox={crop}>
        <image
          href={art}
          x={viewBox.x}
          y={viewBox.y}
          width={viewBox.width}
          height={viewBox.height}
        />
      </svg>
    </svg>
  );
}

type DecorationPanelProps = {
  step: Step;
  frames: FrameDef[];
  effectiveFrameId: FrameId | null;
  onSelectFrame: (frameId: FrameId) => void;
  background: BackgroundChoice | null;
  onSelectBackground: (backgroundId: BackgroundId) => void;
  /** The rainbow swatch: selects the solid colour and opens or closes the wheel. */
  onSelectRainbow: () => void;
  /** Mounted only while open; `wheelColor` is where it starts each time it opens. */
  isWheelOpen: boolean;
  wheelColor: SolidColor;
  onPreviewColor: (color: SolidColor) => void;
  onCommitColor: (color: SolidColor) => void;
  /** `state.uploadedBackground`: the last picture the user uploaded, if any. */
  uploadedBackground: string | null;
  onSelectUploaded: () => void;
  /** The last swatch: opens the file picker. */
  onUploadClick: () => void;
  isUploading: boolean;
  uploadError: string | null;
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
  frames,
  effectiveFrameId,
  onSelectFrame,
  background,
  onSelectBackground,
  onSelectRainbow,
  isWheelOpen,
  wheelColor,
  onPreviewColor,
  onCommitColor,
  uploadedBackground,
  onSelectUploaded,
  onUploadClick,
  isUploading,
  uploadError,
  stickerStyle,
  onStickerStyleChange,
  onAddSticker,
}: DecorationPanelProps) {
  const hasBackground = resolveBackground(background, uploadedBackground) !== null;
  const isUploadedSelected = background === UPLOADED_BACKGROUND && uploadedBackground !== null;
  const isSolid = toSolidColor(background) !== null;

  return (
    <div className={styles.panel}>
      <h2 className={styles.panelTitle}>{PANEL_TITLES[step]}</h2>

      {/* Step 2 is mandatory (owner, 2026-10-21): `Next step` stays disabled until a
          background is chosen, and this says why. */}
      {step === 'backgrounds' && !hasBackground && (
        <p id={BACKGROUND_HINT_ID} className={styles.hint}>
          Pick a background to continue.
        </p>
      )}

      {step === 'backgrounds' && uploadError && (
        <p className={styles.error} role="alert">
          {uploadError}
        </p>
      )}

      {step === 'backgrounds' && isWheelOpen && (
        <ColorWheel initialColor={wheelColor} onPreview={onPreviewColor} onCommit={onCommitColor} />
      )}

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

        {step === 'backgrounds' && (
          <button
            type="button"
            className={`${styles.swatch} ${styles.backgroundSwatch} ${styles.rainbowSwatch} ${
              isSolid ? styles.swatchSelected : ''
            }`.trim()}
            aria-pressed={isSolid}
            aria-expanded={isWheelOpen}
            aria-label="Solid color background"
            onClick={onSelectRainbow}
          />
        )}

        {step === 'backgrounds' &&
          BACKGROUND_LIST.map((art, index) => (
            <button
              key={art.id}
              type="button"
              className={`${styles.swatch} ${styles.backgroundSwatch} ${
                art.id === background ? styles.swatchSelected : ''
              }`.trim()}
              aria-pressed={art.id === background}
              // By position, not by file stem: the two art folders both have a "1".
              aria-label={`Background ${index + 1}`}
              onClick={() => onSelectBackground(art.id)}
            >
              <img src={art.src} alt="" />
            </button>
          ))}

        {/* The user's own background — only the last one uploaded — right before the button
            that replaces it. */}
        {step === 'backgrounds' && uploadedBackground && (
          <button
            type="button"
            className={`${styles.swatch} ${styles.backgroundSwatch} ${
              isUploadedSelected ? styles.swatchSelected : ''
            }`.trim()}
            aria-pressed={isUploadedSelected}
            aria-label="Your background"
            onClick={onSelectUploaded}
          >
            <img src={uploadedBackground} alt="" />
          </button>
        )}

        {step === 'backgrounds' && (
          <button
            type="button"
            className={`${styles.swatch} ${styles.uploadSwatch}`}
            aria-label={
              uploadedBackground ? 'Upload another background' : 'Upload your own background'
            }
            aria-busy={isUploading}
            disabled={isUploading}
            onClick={onUploadClick}
          >
            <span aria-hidden="true">{isUploading ? '…' : '+'}</span>
          </button>
        )}

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

  // The solid-colour wheel: whether it is open, the last colour committed (where it reopens),
  // and the colour of a gesture still in progress, which only the preview sees.
  const [isWheelOpen, setIsWheelOpen] = useState(false);
  const [lastColor, setLastColor] = useState<SolidColor>(
    () => toSolidColor(state.background) ?? DEFAULT_SOLID_COLOR,
  );
  const [draftColor, setDraftColor] = useState<SolidColor | null>(null);

  // The user's own background: the hidden file input the last swatch opens, and its states.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

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

  const handleTransformSticker = useCallback(
    (instanceId: string, rotation: number, scale: number) => {
      dispatch({ type: 'TRANSFORM_STICKER', instanceId, rotation, scale });
    },
    [dispatch],
  );

  const {
    stickers,
    selectedId,
    select,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  } = useStickers(canvasRef, {
    layout: state.selectedLayout,
    stickers: state.stickers,
    onMove: handleMoveSticker,
    onRemove: handleRemoveSticker,
    onTransform: handleTransformSticker,
  });

  // `stickers` (from the hook), not `state.stickers`: it is the same array when nothing
  // is being dragged, so this does not loop, and it is what shows the live drag position.
  // `selectedStickerId` only paints the selection box here; the download never carries it.
  // `draftColor` likewise: the wheel's live colour, painted before it is committed.
  useEffect(() => {
    void draw({
      ...state,
      background: draftColor ?? state.background,
      stickers,
      selectedStickerId: selectedId,
    });
  }, [draw, state, stickers, selectedId, draftColor]);

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
    setIsWheelOpen(false);
    setUploadError(null);
    dispatch({ type: 'SET_BACKGROUND', background: backgroundId });
  };

  // Choosing the rainbow is choosing a colour: it selects the last one at once (so `Next
  // step` unlocks) and opens the wheel. Pressed again while selected, it only closes it.
  const handleSelectRainbow = () => {
    setUploadError(null);
    if (isWheelOpen && toSolidColor(state.background)) {
      setIsWheelOpen(false);
      return;
    }
    dispatch({ type: 'SET_BACKGROUND', background: lastColor });
    setIsWheelOpen(true);
  };

  const handleSelectUploaded = () => {
    setIsWheelOpen(false);
    setUploadError(null);
    dispatch({ type: 'SET_BACKGROUND', background: UPLOADED_BACKGROUND });
  };

  const handleUploadClick = () => {
    if (fileInputRef.current) fileInputRef.current.value = ''; // the same file twice still fires
    fileInputRef.current?.click();
  };

  // Cover-cropped to this layout's whole canvas on the way in, so the strip draws it 1:1 and
  // sessionStorage holds a strip-sized JPEG, never the 12 MP original (storageService).
  const handleUploadFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);

    if (!isSupportedImageType(file)) {
      setUploadError(UNSUPPORTED_TYPE_MESSAGE);
      return;
    }

    setIsUploading(true);
    try {
      const dataUrl = await fileToDataUrl(file, LAYOUTS[layout].canvas);
      setIsWheelOpen(false);
      dispatch({ type: 'SET_UPLOADED_BACKGROUND', dataUrl });
    } catch {
      setUploadError(UNREADABLE_FILE_MESSAGE);
    } finally {
      setIsUploading(false);
    }
  };

  const handleCommitColor = (color: SolidColor) => {
    setDraftColor(null);
    setLastColor(color);
    dispatch({ type: 'SET_BACKGROUND', background: color });
  };

  const isNextBlocked =
    step === 'backgrounds' &&
    resolveBackground(state.background, state.uploadedBackground) === null;

  const handleAddSticker = (assetId: StickerId) => {
    const canvas = LAYOUTS[layout].canvas;
    const instanceId = newStickerInstanceId();
    dispatch({
      type: 'ADD_STICKER',
      sticker: {
        instanceId,
        assetId,
        x: Math.round(canvas.width / 2),
        y: Math.round(canvas.height / 2),
        rotation: 0,
        scale: 1,
      },
    });
    // Selected straight away, so its handles show and it can be turned or resized at once.
    select(instanceId);
  };

  const handlePrevious = () => {
    select(null);
    setIsWheelOpen(false);
    if (stepIndex === 0) {
      navigate('/review');
      return;
    }
    setStep(STEPS[stepIndex - 1]);
  };

  const handleNext = () => {
    if (isNextBlocked) return;
    select(null);
    setIsWheelOpen(false);
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
            frames={FRAMES[layout]}
            effectiveFrameId={effectiveFrame?.id ?? null}
            onSelectFrame={handleSelectFrame}
            background={state.background}
            onSelectBackground={handleSelectBackground}
            onSelectRainbow={handleSelectRainbow}
            isWheelOpen={isWheelOpen}
            wheelColor={lastColor}
            onPreviewColor={setDraftColor}
            onCommitColor={handleCommitColor}
            uploadedBackground={state.uploadedBackground}
            onSelectUploaded={handleSelectUploaded}
            onUploadClick={handleUploadClick}
            isUploading={isUploading}
            uploadError={uploadError}
            stickerStyle={stickerStyle}
            onStickerStyleChange={setStickerStyle}
            onAddSticker={handleAddSticker}
          />

          {/* Layout-free on desktop (`display: contents`); on mobile, the box the strip is
              sized against so it fits the height left above the panel. */}
          <div className={styles.previewArea}>
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
        </div>

        <div className={styles.footerActions}>
          <Button type="button" onClick={handlePrevious}>
            ← Previous step
          </Button>
          <Button
            type="button"
            onClick={handleNext}
            disabled={isNextBlocked}
            aria-describedby={isNextBlocked ? BACKGROUND_HINT_ID : undefined}
          >
            Next step →
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT_ATTRIBUTE}
          className={styles.visuallyHidden}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            void handleUploadFile(event.target.files?.[0]);
          }}
        />
      </WebAppOldStyle>
    </PageShell>
  );
}

export default DecorationPage;
