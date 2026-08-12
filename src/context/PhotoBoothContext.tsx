import { createContext, useContext, useEffect, useReducer } from 'react';
import type { Dispatch, ReactNode } from 'react';
import type { PhotoBoothAction, PhotoBoothState } from '../types/photobooth';
import { loadState, scheduleSave } from '../services/storageService';

const initialState: PhotoBoothState = {
  selectedLayout: null,
  source: null,
  photos: [],
  frame: null,
  background: null,
  stickers: [],
};

function photoBoothReducer(state: PhotoBoothState, action: PhotoBoothAction): PhotoBoothState {
  switch (action.type) {
    case 'SET_LAYOUT':
      return { ...state, selectedLayout: action.layout };

    case 'SET_SOURCE':
      return { ...state, source: action.source };

    case 'ADD_PHOTO':
      if (state.photos.length >= 4) {
        return state;
      }
      return { ...state, photos: [...state.photos, action.photo] };

    case 'SET_PHOTOS':
      return { ...state, photos: action.photos.slice(0, 4) };

    case 'CLEAR_PHOTOS':
      return { ...state, photos: [] };

    case 'SET_FRAME':
      return { ...state, frame: action.frame };

    case 'SET_BACKGROUND':
      return { ...state, background: action.background };

    case 'ADD_STICKER':
      return { ...state, stickers: [...state.stickers, action.sticker] };

    case 'MOVE_STICKER':
      return {
        ...state,
        stickers: state.stickers.map((sticker) =>
          sticker.instanceId === action.instanceId
            ? { ...sticker, x: action.x, y: action.y }
            : sticker,
        ),
      };

    case 'REMOVE_STICKER':
      return {
        ...state,
        stickers: state.stickers.filter((sticker) => sticker.instanceId !== action.instanceId),
      };

    case 'RESET':
      return initialState;
  }
}

type PhotoBoothContextValue = {
  state: PhotoBoothState;
  dispatch: Dispatch<PhotoBoothAction>;
};

const PhotoBoothContext = createContext<PhotoBoothContextValue | undefined>(undefined);

function PhotoBoothProvider({ children }: { children: ReactNode }) {
  // Hydrate in the reducer's lazy initializer, not in an effect: an effect would run its
  // first `scheduleSave` against `initialState` before `loadState()` ever read the disk,
  // overwriting whatever was there. See services/storageService.ts's own wiring note.
  const [state, dispatch] = useReducer(
    photoBoothReducer,
    initialState,
    (fallback) => loadState() ?? fallback,
  );

  useEffect(() => {
    scheduleSave(state);
  }, [state]);

  return (
    <PhotoBoothContext.Provider value={{ state, dispatch }}>{children}</PhotoBoothContext.Provider>
  );
}

function usePhotoBooth() {
  const context = useContext(PhotoBoothContext);
  if (!context) {
    throw new Error('usePhotoBooth must be used within a PhotoBoothProvider');
  }
  return context;
}

export { PhotoBoothProvider, usePhotoBooth };
