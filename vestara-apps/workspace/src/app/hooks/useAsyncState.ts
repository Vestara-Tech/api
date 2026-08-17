import { useEffect, useState, type DependencyList } from 'react';

export interface AsyncState<T> {
  readonly status: 'loading' | 'ready' | 'error';
  readonly data?: T;
  readonly error?: string;
}

type UseAsyncStateImplementation = <T>(loader: (signal: AbortSignal) => Promise<T>, deps: DependencyList) => AsyncState<T>;

function createUseAsyncStateImplementation(): UseAsyncStateImplementation {
  return function useAsyncStateImpl<T>(loader: (signal: AbortSignal) => Promise<T>, deps: DependencyList): AsyncState<T> {
    const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });

    useEffect(() => {
      const controller = new AbortController();
      setState({ status: 'loading' });

      void (async () => {
        try {
          const data = await loader(controller.signal);
          if (controller.signal.aborted) return;
          setState({ status: 'ready', data });
        } catch (err) {
          if (controller.signal.aborted) return;
          setState({ status: 'error', error: err instanceof Error ? err.message : 'Request failed' });
        }
      })();

      return () => controller.abort();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return state;
  };
}

const defaultUseAsyncStateImplementation = createUseAsyncStateImplementation();

interface WorkspaceAsyncStateTestStore {
  useAsyncStateImplementation: UseAsyncStateImplementation;
}

const globalWorkspaceAsyncStateStore = globalThis as typeof globalThis & {
  __vestaraWorkspaceAsyncStateTestStore__?: WorkspaceAsyncStateTestStore;
};

function getWorkspaceAsyncStateTestStore(): WorkspaceAsyncStateTestStore {
  if (globalWorkspaceAsyncStateStore.__vestaraWorkspaceAsyncStateTestStore__ === undefined) {
    globalWorkspaceAsyncStateStore.__vestaraWorkspaceAsyncStateTestStore__ = {
      useAsyncStateImplementation: defaultUseAsyncStateImplementation,
    };
  }

  return globalWorkspaceAsyncStateStore.__vestaraWorkspaceAsyncStateTestStore__;
}

export function setUseAsyncStateImplementationForTests(implementation?: UseAsyncStateImplementation): void {
  getWorkspaceAsyncStateTestStore().useAsyncStateImplementation = implementation ?? defaultUseAsyncStateImplementation;
}

export function resetUseAsyncStateImplementationForTests(): void {
  getWorkspaceAsyncStateTestStore().useAsyncStateImplementation = defaultUseAsyncStateImplementation;
}

export function useAsyncState<T>(loader: (signal: AbortSignal) => Promise<T>, deps: DependencyList): AsyncState<T> {
  return getWorkspaceAsyncStateTestStore().useAsyncStateImplementation(loader, deps);
}

export function useAsyncStateDefault<T>(loader: (signal: AbortSignal) => Promise<T>, deps: DependencyList): AsyncState<T> {
  return defaultUseAsyncStateImplementation(loader, deps);
}
