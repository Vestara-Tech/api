import { MarketplaceV2 } from '../marketplace/v2/service.js';
import { ContributionRegistryV2, CapabilityResolver } from '../marketplace/v2/contributions.js';
import { DependencyImpactAnalyzer } from '../marketplace/v2/impact.js';
import { registerPlatformContributions, type PlatformRegistryReads } from '../marketplace/v2/wiring.js';
import type { LocalPackageRegistry } from '../marketplace/registry/local-package-registry.js';

export interface MarketplaceV2Platform {
  readonly service: MarketplaceV2;
}

/**
 * MKT2 — Composition root. Capability resolver is wired to platform module
 * enablement (default: all enabled in-process). Live platform modules register
 * their contributions (MKT2-006..010) so every module is independently
 * distributable. Version/channel management (MKT2-018), update policies
 * (MKT2-019) and dependency impact analysis (MKT2-020) are composed in.
 */
export function buildMarketplaceV2Platform(platform?: PlatformRegistryReads, packageRegistry?: LocalPackageRegistry): MarketplaceV2Platform {
  const contributionRegistry = new ContributionRegistryV2();
  const capabilityResolver = new CapabilityResolver({
    registry: contributionRegistry,
    isModuleEnabled: () => true,
    isCapabilityPresent: () => true,
  });
  const impact = new DependencyImpactAnalyzer({
    registry: contributionRegistry,
    dependentsOf: (packageId) => {
      if (!packageRegistry) return [];
      return packageRegistry
        .listAvailable()
        .filter((p) => p.dependencies.some((d) => d.packageId === packageId))
        .flatMap((p) => p.dependencies.filter((d) => d.packageId === packageId).map((d) => ({ packageId: p.id, versionRange: d.versionRange, required: d.required })));
    },
  });
  const service = new MarketplaceV2({ contributionRegistry, capabilityResolver, impact });
  if (platform) registerPlatformContributions(contributionRegistry, platform);
  return { service };
}
