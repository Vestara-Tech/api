import type { ReactNode } from 'react';

export type VestaraThemeSource = 'fallback' | 'remote';
export type VestaraThemeHydrationStatus = 'bootstrapping' | 'hydrating' | 'ready' | 'error';

export interface VestaraThemeSnapshot {
  readonly themeId: string;
  readonly source: VestaraThemeSource;
  readonly status: VestaraThemeHydrationStatus;
  readonly error?: string;
}

export interface VestaraThemeProviderProps {
  readonly children: ReactNode;
  readonly themeId?: string;
  readonly apiBaseUrl?: string;
  readonly onThemeSnapshotChange?: (snapshot: VestaraThemeSnapshot) => void;
  readonly onThemeError?: (error: Error) => void;
}
