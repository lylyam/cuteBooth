import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { LayoutId } from '../constants/layouts';

type PhotoBoothContextValue = {
  selectedLayout: LayoutId | null;
  setSelectedLayout: (layout: LayoutId) => void;
};

const PhotoBoothContext = createContext<PhotoBoothContextValue | undefined>(undefined);

function PhotoBoothProvider({ children }: { children: ReactNode }) {
  const [selectedLayout, setSelectedLayout] = useState<LayoutId | null>(null);

  return (
    <PhotoBoothContext.Provider value={{ selectedLayout, setSelectedLayout }}>
      {children}
    </PhotoBoothContext.Provider>
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
