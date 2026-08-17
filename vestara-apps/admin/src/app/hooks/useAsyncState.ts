import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AsyncState<T> {
  readonly status: AsyncStatus;
  readonly data: T | undefined;
  readonly error: string | undefined;
  readonly refresh: () => Promise<void>;
}

export function useAsyncState<T>(
  loader: (signal?: AbortSignal) => Promise<T>,
  dependencies: readonly unknown[] = [],
): AsyncState<T> {
  const loaderRef = useRef(loader);
  const [status, setStatus] = useState<AsyncStatus>('loading');
  const [data, setData] = useState<T | undefined>();
  const [error, setError] = useState<string | undefined>();

  const refresh = useCallback(async (): Promise<void> => {
    const controller = new AbortController();
    setStatus('loading');
    setError(undefined);

    try {
      const next = await loaderRef.current(controller.signal);
      if (controller.signal.aborted) return;
      setData(next);
      setStatus('ready');
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : 'Unable to load data');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    loaderRef.current = loader;
  }, [loader]);

  useEffect(() => {
    const controller = new AbortController();
    setStatus('loading');
    setError(undefined);

    void (async () => {
      try {
        const next = await loaderRef.current(controller.signal);
        if (controller.signal.aborted) return;
        setData(next);
        setStatus('ready');
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : 'Unable to load data');
        setStatus('error');
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies]);

  return { status, data, error, refresh };
}
