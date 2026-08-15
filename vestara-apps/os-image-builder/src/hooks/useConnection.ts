import { useCallback, useEffect, useState } from 'react';
import { ApiClient, type ApiConnectionState } from '@vestara/client';

export function useConnection(client: ApiClient, capabilities: readonly string[] = []) {
  const [state, setState] = useState<ApiConnectionState>({ status: 'unknown' });
  const [attempts, setAttempts] = useState(0);

  const preflight = useCallback(async () => {
    try {
      const result = await client.health();
      setState(result.state);
    } catch {
      setState({ status: 'offline', message: 'Unable to reach the Vestara API', lastAttemptAt: new Date().toISOString() });
    }
  }, [client]);

  useEffect(() => {
    void preflight();
  }, [preflight, attempts]);

  const retry = (): void => setAttempts((a) => a + 1);

  // Degrade if the API is up but the module capability is missing.
  const effective = { ...state };
  if (effective.status === 'online' && capabilities.length > 0 && effective.capabilities) {
    const missing = capabilities.filter((c) => !effective.capabilities!.includes(c));
    if (missing.length > 0) {
      effective.status = 'degraded';
      effective.message = `API online, but module(s) unavailable: ${missing.join(', ')}`;
    }
  }

  return { state: effective, retry, hasCapability: (name: string) => effective.capabilities?.includes(name) ?? false };
}
