/** AI2-002 — Provider configuration states: Installed / Configured / Enabled. */

export type AiProviderLifecycleState = 'installed' | 'configured' | 'enabled';

export type AiProviderHealth = 'healthy' | 'degraded' | 'offline' | 'unknown';

export interface AiProviderConfig {
  readonly id: string;
  readonly name: string;
  readonly installed: boolean;
  readonly configured: boolean;
  readonly enabled: boolean;
  readonly credentialRef?: string; // secret:// reference
  readonly apiEndpoint?: string;
  readonly health: AiProviderHealth;
  readonly lastCheckedAt?: string;
  readonly latencyMs?: number;
}

export function providerState(config: AiProviderConfig): AiProviderLifecycleState {
  if (config.enabled && config.configured && config.installed) return 'enabled';
  if (config.configured && config.installed) return 'configured';
  return 'installed';
}

/** Health-aware scoring: providers that are offline/degraded are deprioritized. */
export function healthScore(health: AiProviderHealth): number {
  switch (health) {
    case 'healthy':
      return 0;
    case 'degraded':
      return 1;
    case 'unknown':
      return 2;
    case 'offline':
      return 3;
  }
}

export function isProviderUsable(config: AiProviderConfig): boolean {
  return config.enabled && config.configured && config.installed && config.health !== 'offline';
}

export interface AiProviderStatePort {
  getProviderState(id: string): AiProviderConfig | undefined;
  listProviderStates(): readonly AiProviderConfig[];
}

export class InMemoryAiProviderState implements AiProviderStatePort {
  private readonly states = new Map<string, AiProviderConfig>();

  upsert(state: AiProviderConfig): void {
    this.states.set(state.id, state);
  }

  getProviderState(id: string): AiProviderConfig | undefined {
    return this.states.get(id);
  }

  listProviderStates(): readonly AiProviderConfig[] {
    return [...this.states.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}
