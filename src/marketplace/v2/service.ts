import { ContributionRegistryV2, CapabilityResolver } from './contributions.js';
import { MarketplaceDistributionService } from './distribution.js';
import { MarketplacePublisherService } from './publishing.js';
import type { PublisherIdentity } from './contracts.js';

export interface MarketplaceV2Options {
  readonly contributionRegistry?: ContributionRegistryV2;
  readonly capabilityResolver?: CapabilityResolver;
  readonly distributions?: MarketplaceDistributionService;
  readonly publisher?: MarketplacePublisherService;
}

/** MKT2 — Marketplace v2 composition. Universal capability distribution platform. */
export class MarketplaceV2 {
  readonly contributionRegistry: ContributionRegistryV2;
  readonly capabilityResolver: CapabilityResolver;
  readonly distributions: MarketplaceDistributionService;
  readonly publisher: MarketplacePublisherService;

  constructor(options: MarketplaceV2Options = {}) {
    this.contributionRegistry = options.contributionRegistry ?? new ContributionRegistryV2();
    this.capabilityResolver = options.capabilityResolver ?? new CapabilityResolver({ registry: this.contributionRegistry, isModuleEnabled: () => true, isCapabilityPresent: () => true });
    this.distributions = options.distributions ?? new MarketplaceDistributionService();
    this.publisher = options.publisher ?? new MarketplacePublisherService();
  }

  registerPublisher(publisher: PublisherIdentity): void {
    this.publisher.registerPublisher(publisher);
  }
}
