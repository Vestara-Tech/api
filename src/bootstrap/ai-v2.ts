import type { AiModelCatalog } from '../ai/catalog/model-catalog.js';
import type { AiProviderRegistry } from '../ai/providers/provider-registry.js';
import { buildAiPlatformV2, type AiPlatformV2 } from '../ai/v2/ai-platform-v2.js';
import type { AiProviderConfig } from '../ai/v2/provider-state.js';

/**
 * AI2 — Composition root. Builds the profile + provider-state + routing v2
 * platform over the base AI service's catalog/registry.
 */
export function buildAiPlatformV2Service(catalog: AiModelCatalog, providers: AiProviderRegistry, providerStates?: readonly AiProviderConfig[]): AiPlatformV2 {
  return buildAiPlatformV2({ catalog, providers, ...(providerStates ? { providerStates } : {}) });
}
