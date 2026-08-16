import { ContributionRegistryV2, CapabilityResolver } from './contributions.js';
import { MarketplaceDistributionService } from './distribution.js';
import { MarketplacePublisherService } from './publishing.js';
import { PackageVersionService } from './versioning.js';
import { UpdatePolicyEngine } from './updates.js';
import { DependencyImpactAnalyzer, type ImpactAnalysisOptions } from './impact.js';
import type { PublisherIdentity } from './contracts.js';

export interface MarketplaceV2Options {
  readonly contributionRegistry?: ContributionRegistryV2;
  readonly capabilityResolver?: CapabilityResolver;
  readonly distributions?: MarketplaceDistributionService;
  readonly publisher?: MarketplacePublisherService;
  readonly versions?: PackageVersionService;
  readonly updates?: UpdatePolicyEngine;
  readonly impact?: DependencyImpactAnalyzer;
}

/** MKT2 — Marketplace v2 composition. Universal capability distribution platform. */
export class MarketplaceV2 {
  readonly contributionRegistry: ContributionRegistryV2;
  readonly capabilityResolver: CapabilityResolver;
  readonly distributions: MarketplaceDistributionService;
  readonly publisher: MarketplacePublisherService;
  readonly versions: PackageVersionService;
  readonly updates: UpdatePolicyEngine;
  readonly impact: DependencyImpactAnalyzer;

  constructor(options: MarketplaceV2Options = {}) {
    this.contributionRegistry = options.contributionRegistry ?? new ContributionRegistryV2();
    this.capabilityResolver = options.capabilityResolver ?? new CapabilityResolver({ registry: this.contributionRegistry, isModuleEnabled: () => true, isCapabilityPresent: () => true });
    this.distributions = options.distributions ?? new MarketplaceDistributionService();
    this.publisher = options.publisher ?? new MarketplacePublisherService();
    this.versions = options.versions ?? new PackageVersionService();
    this.updates = options.updates ?? new UpdatePolicyEngine();
    const impactOptions: ImpactAnalysisOptions = {
      registry: this.contributionRegistry,
      dependentsOf: () => [],
    };
    this.impact = options.impact ?? new DependencyImpactAnalyzer(impactOptions);
  }

  registerPublisher(publisher: PublisherIdentity): void {
    this.publisher.registerPublisher(publisher);
  }
}
