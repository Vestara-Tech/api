import { describe, expect, it } from 'vitest';
import { ContributionRegistryV2 } from '../../src/marketplace/v2/contributions.js';
import { PackageVersionService, InMemoryVersionStore } from '../../src/marketplace/v2/versioning.js';
import { UpdatePolicyEngine, isMajorBump } from '../../src/marketplace/v2/updates.js';
import { DependencyImpactAnalyzer } from '../../src/marketplace/v2/impact.js';

describe('MKT2-018 version/channel management', () => {
  it('publishes versions to channels and lists them newest-first', () => {
    const versions = new PackageVersionService();
    versions.publish({ packageId: 'dev-agent', version: '1.0.0', channel: 'stable' });
    versions.publish({ packageId: 'dev-agent', version: '1.1.0', channel: 'stable' });
    versions.publish({ packageId: 'dev-agent', version: '2.0.0-beta.1', channel: 'beta', changelog: 'preview' });

    const list = versions.listVersions('dev-agent');
    expect(list).toHaveLength(3);
    expect(list[0]!.version).toBe('2.0.0-beta.1');
    expect(versions.latestForChannel('dev-agent', 'stable')!.version).toBe('1.1.0');
    expect(versions.latestForChannel('dev-agent', 'beta')!.version).toBe('2.0.0-beta.1');
  });

  it('promotes a version between channels and rejects duplicate versions on a channel', () => {
    const store = new InMemoryVersionStore();
    const versions = new PackageVersionService({ store });
    versions.publish({ packageId: 'pkg', version: '1.0.0', channel: 'beta' });
    const promoted = versions.promote('pkg', '1.0.0', 'stable');
    expect(promoted.channel).toBe('stable');
    expect(versions.latestForChannel('pkg', 'stable')!.version).toBe('1.0.0');
    expect(() => versions.publish({ packageId: 'pkg', version: '1.0.0', channel: 'beta' })).toThrow();
  });

  it('exposes channels a package has versions on', () => {
    const versions = new PackageVersionService();
    versions.publish({ packageId: 'p', version: '1.0.0', channel: 'stable' });
    versions.publish({ packageId: 'p', version: '1.1.0', channel: 'canary' });
    expect(versions.channels('p')).toContain('stable');
    expect(versions.channels('p')).toContain('canary');
  });
});

describe('MKT2-019 update policies', () => {
  it('detects major version bumps', () => {
    expect(isMajorBump('1.4.0', '2.0.0')).toBe(true);
    expect(isMajorBump('1.4.0', '1.5.0')).toBe(false);
  });

  it('auto applies compatible updates', () => {
    const engine = new UpdatePolicyEngine();
    engine.set({ packageId: 'p', policy: 'auto', channel: 'stable' });
    const result = engine.evaluate('1.0.0', '1.2.0', 'stable', engine.policyFor('p')!);
    expect(result.updateAvailable).toBe(true);
    expect(result.action).toBe('apply');
  });

  it('holds major bumps under auto policy with blockMajor', () => {
    const engine = new UpdatePolicyEngine();
    engine.set({ packageId: 'p', policy: 'auto', channel: 'stable', blockMajor: true });
    const result = engine.evaluate('1.0.0', '2.0.0', 'stable', engine.policyFor('p')!);
    expect(result.action).toBe('hold');
    expect(result.breaking).toBe(true);
    expect(result.reason).toContain('blocked');
  });

  it('prompts under manual policy and reports no update when current', () => {
    const engine = new UpdatePolicyEngine();
    engine.set({ packageId: 'p', policy: 'manual', channel: 'stable' });
    const prompt = engine.evaluate('1.0.0', '1.1.0', 'stable', engine.policyFor('p')!);
    expect(prompt.action).toBe('prompt');
    const none = engine.evaluate('1.1.0', '1.1.0', 'stable', engine.policyFor('p')!);
    expect(none.updateAvailable).toBe(false);
    expect(none.action).toBe('none');
  });
});

describe('MKT2-020 dependency impact analysis', () => {
  const registry = new ContributionRegistryV2();
  registry.register('dev-agent', '1.4.0', {
    provides: [{ kind: 'agent', id: 'developer-agent', name: 'Developer Agent' }],
    requires: [{ module: 'agent', capability: 'agent.runtime' }, { module: 'file', capability: 'filesystem.read' }],
    optional: [],
  });

  it('flags breaking impact when a dependent version range would no longer hold', () => {
    const analyzer = new DependencyImpactAnalyzer({
      registry,
      dependentsOf: () => [{ packageId: 'engineering-workspace', versionRange: '<2.0.0', required: true }],
    });
    const impact = analyzer.analyze('1.4.0', { packageId: 'dev-agent', version: '2.0.0', channel: 'stable', publishedAt: new Date().toISOString() });
    expect(impact.breaking).toBe(true);
    expect(impact.reverseDependencies[0]!.stillSatisfied).toBe(false);
  });

  it('reports no breaking impact for compatible updates and surfaces capability changes', () => {
    const analyzer = new DependencyImpactAnalyzer({
      registry,
      dependentsOf: () => [{ packageId: 'workspace', versionRange: '>=1.0.0', required: true }],
    });
    const impact = analyzer.analyze('1.4.0', { packageId: 'dev-agent', version: '1.5.0', channel: 'stable', publishedAt: new Date().toISOString() });
    expect(impact.breaking).toBe(false);
    expect(impact.reverseDependencies[0]!.stillSatisfied).toBe(true);
  });
});
