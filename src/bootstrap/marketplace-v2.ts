import { MarketplaceV2 } from '../marketplace/v2/service.js';
import { ContributionRegistryV2, CapabilityResolver } from '../marketplace/v2/contributions.js';

export interface MarketplaceV2Platform {
  readonly service: MarketplaceV2;
}

/**
 * MKT2 — Composition root. Capability resolver is wired to platform module
 * enablement (default: all enabled in-process).
 */
export function buildMarketplaceV2Platform(): MarketplaceV2Platform {
  const contributionRegistry = new ContributionRegistryV2();
  const capabilityResolver = new CapabilityResolver({
    registry: contributionRegistry,
    isModuleEnabled: () => true,
    isCapabilityPresent: () => true,
  });
  const service = new MarketplaceV2({ contributionRegistry, capabilityResolver });
  return { service };
}
