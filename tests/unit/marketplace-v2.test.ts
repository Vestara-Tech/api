import { describe, expect, it } from 'vitest';
import {
  ContributionRegistryV2,
  CapabilityResolver,
  MarketplaceDistributionService,
  signPackage,
  runSecurityScan,
  buildPackageEvidence,
  MarketplacePublisherService,
  InMemoryPublisherStore,
  MarketplaceV2,
  type ContributionManifestV2,
} from '../../src/marketplace/v2/index.js';

const DEV_AGENT_MANIFEST: ContributionManifestV2 = {
  provides: [
    { kind: 'agent', id: 'developer-agent', name: 'Developer Agent' },
    { kind: 'skill', id: 'typescript', name: 'TypeScript Skill' },
    { kind: 'tool', id: 'git-tool', name: 'Git Tool' },
  ],
  requires: [
    { module: 'agent', capability: 'agent.runtime' },
    { module: 'ai', capability: 'ai.generate' },
    { module: 'file', capability: 'filesystem.read' },
  ],
  optional: [
    { module: 'browser', capability: 'browser.automation' },
    { module: 'git', capability: 'git.integration' },
  ],
};

describe('MKT2-002 contribution manifest v2', () => {
  it('registers manifests and resolves provides by kind and id', () => {
    const registry = new ContributionRegistryV2();
    registry.register('developer-pack', '1.0.0', DEV_AGENT_MANIFEST);
    expect(registry.contributions()).toHaveLength(1);

    const agents = registry.provides('agent');
    expect(agents.some((a) => a.id === 'developer-agent')).toBe(true);

    const byId = registry.providesById('git-tool');
    expect(byId[0]!.kind).toBe('tool');
    expect(byId[0]!.packageId).toBe('developer-pack');
  });

  it('unregisters contributions when a package is disabled', () => {
    const registry = new ContributionRegistryV2();
    registry.register('pack', '1', DEV_AGENT_MANIFEST);
    registry.unregister('pack');
    expect(registry.contributions()).toHaveLength(0);
  });
});

describe('MKT2-003 capability resolver', () => {
  it('resolves required + optional capabilities against the platform', () => {
    const registry = new ContributionRegistryV2();
    const resolver = new CapabilityResolver({
      registry,
      isModuleEnabled: (module) => ['agent', 'ai', 'file'].includes(module),
      isCapabilityPresent: (cap) => ['agent.runtime', 'ai.generate', 'filesystem.read'].includes(cap),
    });
    const result = resolver.resolve(DEV_AGENT_MANIFEST);
    expect(result.ok).toBe(true);
    expect(result.missingRequired).toHaveLength(0);
    expect(result.issues.filter((i) => i.required && i.satisfied)).toHaveLength(3);
    // optional browser/git not satisfied but not blocking
    expect(result.issues.filter((i) => !i.required && !i.satisfied)).toHaveLength(2);
  });

  it('reports missing required capabilities', () => {
    const resolver = new CapabilityResolver({ registry: new ContributionRegistryV2(), isModuleEnabled: () => false, isCapabilityPresent: () => false });
    const result = resolver.resolve(DEV_AGENT_MANIFEST);
    expect(result.ok).toBe(false);
    expect(result.missingRequired.length).toBeGreaterThan(0);
  });
});

describe('MKT2-004/005 bundles + distributions', () => {
  it('creates bundles and distributions and plans an install', () => {
    const service = new MarketplaceDistributionService();
    const bundle = service.createBundle({
      name: 'Full-Stack Dev',
      packages: [{ packageId: 'developer-agent', required: true }, { packageId: 'typescript-skill', required: true }],
      recommended: [{ packageId: 'git-tool' }],
      optional: [{ packageId: 'browser-tool' }],
      ai: ['vestara.coding'],
      metadata: {},
    });
    const distribution = service.createDistribution({
      name: 'Full Stack Development',
      bundles: [{ bundleId: bundle.bundleId, required: true }],
      packages: [{ packageId: 'engineering-workspace', required: true }],
      channel: 'stable',
      curatedBy: 'vestara',
      ai: ['openai'],
      metadata: {},
    });
    const plan = service.planDistribution(distribution.distributionId);
    expect(plan.required).toContain('engineering-workspace');
    expect(plan.required).toContain('developer-agent');
    expect(plan.recommended).toContain('git-tool');
    expect(plan.ai).toContain('vestara.coding');
    expect(plan.total).toBeGreaterThan(0);
  });
});

describe('MKT2-012/013/014 signing + security + evidence', () => {
  it('signs a package deterministically', () => {
    const sig = signPackage({ packageId: 'p', version: '1.0.0', signer: 'vestara', keyId: 'k' });
    expect(sig.signature.startsWith('sig-')).toBe(true);
  });

  it('blocks packages with critical/high findings', () => {
    const blocked = runSecurityScan('p', '1.0.0', [{ severity: 'critical', message: 'RCE' }]);
    expect(blocked.blocked).toBe(true);
    const clean = runSecurityScan('p', '1.0.0', [{ severity: 'low', message: 'info' }]);
    expect(clean.blocked).toBe(false);
  });

  it('builds evidence with a deterministic hash', () => {
    const evidence = buildPackageEvidence({ packageId: 'p', version: '1.0.0', buildId: 'b', securityScanId: 's', compatibilityHash: 'c', signature: 'sig-x', signer: 'vestara' });
    expect(evidence.evidenceHash).toBeTruthy();
  });
});

describe('MKT2-016/017 publisher + publishing', () => {
  it('publishes with trust level and refuses unknown publishers', () => {
    const publisher = new MarketplacePublisherService();
    publisher.registerPublisher({ publisherId: 'vestara', name: 'Vestara', trustLevel: 'vestara-official', verified: true, ownerUserId: 'u1' });

    const result = publisher.publish({ packageId: 'dev-agent', version: '1.0.0', kind: 'agent', publisherId: 'vestara', buildId: 'b1', securityScanId: 's1', compatibilityHash: 'c1', channel: 'stable' }, 'key');
    expect(result.ok).toBe(true);
    expect(result.published!.trustLevel).toBe('vestara-official');
    expect(publisher.listPublished()).toHaveLength(1);

    const unknown = publisher.publish({ packageId: 'x', version: '1', kind: 'app', publisherId: 'nobody', buildId: 'b', securityScanId: 's', compatibilityHash: 'c', channel: 'stable' }, 'key');
    expect(unknown.ok).toBe(false);
  });
});

describe('MKT2 MarketplaceV2 composition', () => {
  it('composes registry + resolver + distributions + publisher', () => {
    const marketplace = new MarketplaceV2();
    marketplace.contributionRegistry.register('pack', '1.0.0', DEV_AGENT_MANIFEST);
    expect(marketplace.contributionRegistry.provides('agent')).toHaveLength(1);
    expect(marketplace.capabilityResolver.resolve(DEV_AGENT_MANIFEST).ok).toBe(true);
    expect(marketplace.distributions.listBundles()).toHaveLength(0);
    marketplace.registerPublisher({ publisherId: 'p', name: 'P', trustLevel: 'community', verified: false });
    expect(marketplace.publisher.listPublished()).toHaveLength(0);
  });
});
