import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ThemeProvider, type Theme, type ThemeOptions } from '@mui/material/styles';

import {
  buildMuiThemeFromDefinition,
  buildMuiThemeFromOptions,
  fallbackMuiTheme,
  fallbackThemeDefinition,
} from './fallbackTheme.js';
import type { VestaraThemeProviderProps, VestaraThemeSnapshot } from './types.js';

const VestaraThemeSnapshotContext = createContext<VestaraThemeSnapshot>({
  themeId: fallbackThemeDefinition.id,
  source: 'fallback',
  status: 'bootstrapping',
});

export function useVestaraThemeSnapshot(): VestaraThemeSnapshot {
  return useContext(VestaraThemeSnapshotContext);
}

export function buildThemeEndpoint(apiBaseUrl: string, themeId: string): string {
  const base = apiBaseUrl.trim().replace(/\/$/, '');
  return `${base}/v2/themes/${encodeURIComponent(themeId)}/mui`;
}

function resolveThemeId(themeId?: string): string {
  return themeId?.trim() ? themeId.trim() : fallbackThemeDefinition.id;
}

export function VestaraThemeProvider({
  children,
  themeId,
  apiBaseUrl = '/api',
  onThemeSnapshotChange,
  onThemeError,
}: VestaraThemeProviderProps): ReactNode {
  const resolvedThemeId = resolveThemeId(themeId);
  const endpoint = useMemo(() => buildThemeEndpoint(apiBaseUrl, resolvedThemeId), [apiBaseUrl, resolvedThemeId]);
  const [theme, setTheme] = useState<Theme>(() => fallbackMuiTheme);
  const [snapshot, setSnapshot] = useState<VestaraThemeSnapshot>(() => ({
    themeId: resolvedThemeId,
    source: 'fallback',
    status: 'bootstrapping',
  }));

  useEffect(() => {
    const controller = new AbortController();

    setTheme(fallbackMuiTheme);
    setSnapshot({
      themeId: resolvedThemeId,
      source: 'fallback',
      status: 'hydrating',
    });

    const hydrate = async (): Promise<void> => {
      try {
        const response = await fetch(endpoint, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Theme request failed with ${response.status} ${response.statusText}`);
        }

        const remoteTheme = (await response.json()) as ThemeOptions;
        if (controller.signal.aborted) return;

        setTheme(buildMuiThemeFromOptions(remoteTheme));
        const nextSnapshot: VestaraThemeSnapshot = {
          themeId: resolvedThemeId,
          source: 'remote',
          status: 'ready',
        };
        setSnapshot(nextSnapshot);
        onThemeSnapshotChange?.(nextSnapshot);
      } catch (error) {
        if (controller.signal.aborted) return;

        const themeError = error instanceof Error ? error : new Error('Unable to resolve Vestara theme');
        const nextSnapshot: VestaraThemeSnapshot = {
          themeId: resolvedThemeId,
          source: 'fallback',
          status: 'error',
          error: themeError.message,
        };
        setSnapshot(nextSnapshot);
        onThemeSnapshotChange?.(nextSnapshot);
        onThemeError?.(themeError);
      }
    };

    void hydrate();

    return () => {
      controller.abort();
    };
  }, [endpoint, onThemeError, onThemeSnapshotChange, resolvedThemeId]);

  return (
    <VestaraThemeSnapshotContext.Provider value={snapshot}>
      <ThemeProvider theme={theme}>{children}</ThemeProvider>
    </VestaraThemeSnapshotContext.Provider>
  );
}

export { buildMuiThemeFromDefinition, buildMuiThemeFromOptions, fallbackMuiTheme, fallbackThemeDefinition };
