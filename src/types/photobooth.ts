/**
 * Global state contract — see docs/contracts/state.md.
 *
 * `LayoutId` and the slot geometry are NOT defined here: they live in
 * `constants/layouts.ts` (nodo S2). This module only imports the type.
 *
 * `FrameId`, `StickerId` and `BackgroundId` are NOT defined here either — same
 * reasoning. They are the manifest node's (X1) `constants/{frames,stickers,
 * backgrounds}.ts`, re-exported with `export type` so no manifest module (and
 * its `import.meta.glob` calls) is pulled into the state's runtime graph.
 */
import type { LayoutId } from '../constants/layouts';
import type { FrameId } from '../constants/frames';
import type { StickerId } from '../constants/stickers';
import type { BackgroundId } from '../constants/backgrounds';

export type { FrameId, StickerId, BackgroundId };

export type PhotoSource = 'camera' | 'upload';

export type Photo = {
  id: string; // crypto.randomUUID()
  dataUrl: string; // JPEG data URL
};

export type StickerInstance = {
  instanceId: string;
  assetId: StickerId;
  x: number; // px of the active layout's canvas, NOT css px nor %
  y: number;
};

export type PhotoBoothState = {
  selectedLayout: LayoutId | null;
  source: PhotoSource | null;
  photos: Photo[]; // 0..4 · the index IS the slot number
  frame: FrameId | null; // /decoration step 1 · one frame, not 4 masks
  background: BackgroundId | null; // /decoration step 2
  stickers: StickerInstance[]; // /decoration step 3
};

export type PhotoBoothAction =
  | { type: 'SET_LAYOUT'; layout: LayoutId }
  | { type: 'SET_SOURCE'; source: PhotoSource }
  | { type: 'ADD_PHOTO'; photo: Photo }
  | { type: 'SET_PHOTOS'; photos: Photo[] }
  | { type: 'CLEAR_PHOTOS' }
  | { type: 'SET_FRAME'; frame: FrameId | null }
  | { type: 'SET_BACKGROUND'; background: BackgroundId | null }
  | { type: 'ADD_STICKER'; sticker: StickerInstance }
  | { type: 'MOVE_STICKER'; instanceId: string; x: number; y: number }
  | { type: 'REMOVE_STICKER'; instanceId: string }
  | { type: 'RESET' };
