import type { AiModelCatalog } from '../catalog/model-catalog.js';
import type { AiProviderRegistry } from '../providers/provider-registry.js';
import { InMemoryAiProfileStore, defaultAiProfiles, type AiProfile } from './profile.js';
import { InMemoryAiProviderState, type AiProviderConfig } from './provider-state.js';
import { RoutingEngineV2, type RoutingDecision } from './router-v2.js';

export interface AiPlatformV2Options {
  readonly catalog: AiModelCatalog;
  readonly providers: AiProviderRegistry;
  readonly profiles?: readonly AiProfile[];
  readonly providerStates?: readonly AiProviderConfig[];
}

export interface AiPlatformV2 {
  readonly profiles: InMemoryAiProfileStore;
  readonly providerStates: InMemoryAiProviderState;
  readonly router: RoutingEngineV2;
}

/**
 * AI2 — AI Platform v2 composition. Profiles (named model configurations),
 * provider lifecycle states (installed/configured/enabled + health) and the
 * profile-aware routing engine. Modules consume AI capabilities through
 * profiles; they never own provider integrations.
 */
export function buildAiPlatformV2(options: AiPlatformV2Options): AiPlatformV2 {
  const profiles = new InMemoryAiProfileStore();
  for (const profile of options.profiles ?? defaultAiProfiles()) profiles.save(profile);

  const providerStates = new InMemoryAiProviderState();
  for (const state of options.providerStates ?? []) providerStates.upsert(state);

  const router = new RoutingEngineV2({ catalog: options.catalog, providers: options.providers, providerStates });
  return { profiles, providerStates, router };
}

export type { RoutingDecision };
