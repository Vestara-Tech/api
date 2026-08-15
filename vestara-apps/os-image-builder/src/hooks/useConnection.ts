import { useCallback, useEffect, useState } from 'react';
import { ApiClient, type ApiConnectionState, type ApiNegotiationResult } from '@vestara/client';

/**
 * IMG-027/028 — API connection manager. Runs the full startup preflight
 * (health -> system -> capabilities -> contract negotiation) and classifies
 * the result: offline, degraded (capability missing), contract-mismatch or
 * online. Distinguishing these states is what makes "Failed to load
 * profiles. Is the API running?" a diagnostic problem instead of a guess.
 */
export function useConnection(client: ApiClient, capabilities: readonly string[] = []) {
  const [state, setState] = useState<ApiConnectionState>({ status: 'unknown' });
  const [contract, setContract] = useState<ApiNegotiationResult['contract']>(undefined);
  const [attempts, setAttempts] = useState(0);

  const preflight = useCallback(async () => {
    const result = await client.negotiate();
    setState(result.state);
    setContract(result.contract);
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

  return { state: effective, contract, retry, hasCapability: (name: string) => effective.capabilities?.includes(name) ?? false };
}
