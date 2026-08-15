import { useCallback, useEffect, useState } from 'react';
import { imageApi, type BuilderDiagnosticsRun } from '../api/imageApi';

interface BuilderDiagnosticsState {
  readonly run: BuilderDiagnosticsRun | undefined;
  readonly isRunning: boolean;
  readonly error: Error | null;
}

/**
 * IMG-030 — Builder diagnostics. Runs the backend image-builder diagnostic
 * contribution (connectivity, capability, profile load) and surfaces it in
 * the UI, so connection failures are investigated instead of guessed.
 */
export function useBuilderDiagnostics() {
  const [state, setState] = useState<BuilderDiagnosticsState>({ run: undefined, isRunning: false, error: null });

  const run = useCallback(async () => {
    setState((s) => ({ ...s, isRunning: true, error: null }));
    try {
      const runResult = await imageApi.diagnostics();
      setState({ run: runResult, isRunning: false, error: null });
    } catch (err) {
      setState({ run: undefined, isRunning: false, error: err as Error });
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  return { runData: state.run, isRunning: state.isRunning, error: state.error, run };
}
