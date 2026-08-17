import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { AdminApiClient } from '../../api/client.js';

export type CapabilityNavigationStatus = 'loading' | 'ready' | 'error';

export interface CapabilityNavigationContextValue {
  readonly status: CapabilityNavigationStatus;
  readonly enabledCapabilities: ReadonlySet<string>;
  readonly error: string | undefined;
  readonly refresh: () => Promise<void>;
  readonly isAvailable: (capabilities: readonly string[]) => boolean;
}

const CapabilityNavigationContext = createContext<CapabilityNavigationContextValue>({
  status: 'loading',
  enabledCapabilities: new Set<string>(),
  error: undefined,
  refresh: async () => {},
  isAvailable: () => true,
});

export function useCapabilityNavigation(): CapabilityNavigationContextValue {
  return useContext(CapabilityNavigationContext);
}

export interface CapabilityNavigationProviderProps {
  readonly children: ReactNode;
  readonly apiBaseUrl?: string;
}

export function CapabilityNavigationProvider({
  children,
  apiBaseUrl = '/api',
}: CapabilityNavigationProviderProps) {
  const client = useMemo(() => new AdminApiClient(apiBaseUrl), [apiBaseUrl]);
  const [status, setStatus] = useState<CapabilityNavigationStatus>('loading');
  const [enabledCapabilities, setEnabledCapabilities] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async (): Promise<void> => {
    setStatus('loading');
    setError(undefined);
    try {
      const enabled = await client.getEnabledCapabilities();
      setEnabledCapabilities(new Set(enabled));
      setStatus('ready');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load capabilities';
      setError(message);
      setStatus('error');
    }
  }, [client]);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const enabled = await client.getEnabledCapabilities(controller.signal);
        if (controller.signal.aborted) return;
        setEnabledCapabilities(new Set(enabled));
        setStatus('ready');
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Unable to load capabilities');
        setStatus('error');
      }
    })();

    return () => controller.abort();
  }, [client]);

  const value = useMemo<CapabilityNavigationContextValue>(
    () => ({
      status,
      enabledCapabilities,
      error,
      refresh,
      isAvailable: (capabilities: readonly string[]) =>
        status !== 'ready' || capabilities.every((capability) => enabledCapabilities.has(capability)),
    }),
    [enabledCapabilities, error, refresh, status],
  );

  return <CapabilityNavigationContext.Provider value={value}>{children}</CapabilityNavigationContext.Provider>;
}
