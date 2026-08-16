import { MarketplaceV2 } from '../marketplace/v2/service.js';
import { ContributionRegistryV2, CapabilityResolver } from '../marketplace/v2/contributions.js';
import { registerPlatformContributions, type PlatformRegistryReads } from '../marketplace/v2/wiring.js';

export interface MarketplaceV2Platform {
  readonly service: MarketplaceV2;
}

/**
 * MKT2 — Composition root. Capability resolver is wired to platform module
 * enablement (default: all enabled in-process). Live platform modules register
 * their contributions (MKT2-006..010) so every module is independently
 * distributable.
 */
export function buildMarketplaceV2Platform(platform?: PlatformRegistryReads): MarketplaceV2Platform {
  const contributionRegistry = new ContributionRegistryV2();
  const capabilityResolver = new CapabilityResolver({
    registry: contributionRegistry,
    isModuleEnabled: () => true,
    isCapabilityPresent: () => true,
  });
  const service = new MarketplaceV2({ contributionRegistry, capabilityResolver });
  if (platform) registerPlatformContributions(contributionRegistry, platform);
  return { service };
}
