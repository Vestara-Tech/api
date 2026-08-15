import { describe, expect, it } from 'vitest';
import {
  MarketplaceCatalogService,
  LocalPackageRegistry,
  builtinCatalog,
  DependencyResolver,
  satisfies,
  CompatibilityAnalyzer,
  PermissionAnalyzer,
  InstallationService,
  PackageLifecycleService,
  MarketplaceContributionRegistry,
  type SystemCompatibilityContext,
} from '../../src/marketplace/index.js';

function buildPlatform() {
  const registry = new LocalPackageRegistry();
  for (const pkg of builtinCatalog()) registry.catalog(pkg);
  const catalog = new MarketplaceCatalogService(registry);
  const dependencies = new DependencyResolver(registry);
  const compatibility = new CompatibilityAnalyzer();
  const permissions = new PermissionAnalyzer();
  const systemContext: SystemCompatibilityContext = {
    apiVersion: '2.4.0',
    platformVersion: '1.8.0',
    os: 'linux',
    architecture: 'x64',
    nodeVersion: '22.0.0',
    moduleVersions: { 'vestara.integration': '2.1.0' },
  };
  const installer = new InstallationService({ registry, dependencies, compatibility, permissions, systemContext });
  const lifecycle = new PackageLifecycleService(registry);
  return { registry, catalog, dependencies, compatibility, permissions, installer, lifecycle };
}

describe('MKT-006 builtin catalog', () => {
  it('seeds packages across kinds including a composed pack', () => {
    const { registry } = buildPlatform();
    const ids = registry.listAvailable().map((p) => p.id);
    expect(ids).toContain('com.vestara.github');
    expect(ids).toContain('com.vestara.fullstack-pack');
    expect(registry.get('com.vestara.github').kind).toBe('integration');
  });
});

describe('MKT-005/007 catalog search + categories', () => {
  it('searches by name and filters by kind', () => {
    const { catalog } = buildPlatform();
    expect(catalog.search({ search: 'github' }).map((p) => p.id)).toContain('com.vestara.github');
    expect(catalog.search({ kind: 'agent' }).every((p) => p.kind === 'agent')).toBe(true);
    expect(catalog.categories().some((c) => c.name === 'integration')).toBe(true);
  });
});

describe('MKT-008/009 dependency + version resolution', () => {
  it('checks semver ranges', () => {
    expect(satisfies('2.4.0', '>=2.0.0')).toBe(true);
    expect(satisfies('1.9.0', '>=2.0.0')).toBe(false);
    expect(satisfies('2.4.0', '2.4.0')).toBe(true);
  });

  it('resolves the fullstack pack dependencies', () => {
    const { dependencies, registry } = buildPlatform();
    const pack = registry.get('com.vestara.fullstack-pack');
    const resolved = dependencies.resolve(pack, false);
    expect(resolved.every((r) => r.satisfied)).toBe(true);
  });
});

describe('MKT-010 compatibility analyzer', () => {
  it('reports compatible vs incompatible', () => {
    const { compatibility, registry } = buildPlatform();
    const github = registry.get('com.vestara.github');
    const ok = compatibility.analyze(github, {
      apiVersion: '2.4.0', platformVersion: '1.8.0', os: 'linux', architecture: 'x64', nodeVersion: '22.0.0',
      moduleVersions: { 'vestara.integration': '2.1.0' },
    });
    expect(ok.compatible).toBe(true);

    const bad = compatibility.analyze(github, {
      apiVersion: '1.0.0', platformVersion: '1.8.0', os: 'linux', architecture: 'x64', nodeVersion: '22.0.0',
      moduleVersions: { 'vestara.integration': '2.1.0' },
    });
    expect(bad.compatible).toBe(false);
  });
});

describe('MKT-013 permission analysis', () => {
  it('classifies github permissions with approval for workflow.execute', () => {
    const { permissions, registry } = buildPlatform();
    const result = permissions.analyze(registry.get('com.vestara.github'));
    expect(result.permissionCount).toBe(4);
    expect(result.low).toBeGreaterThan(0);
    expect(result.medium).toBeGreaterThan(0);
    expect(result.requireApproval).toContain('workflow.execute');
  });
});

describe('MKT-014/015 governed installer', () => {
  it('reviews and installs a low-risk package', () => {
    const { installer, registry } = buildPlatform();
    const review = installer.review({ packageId: 'com.vestara.typescript-skill' });
    expect(review.installable).toBe(true);
    expect(review.approvalRequired).toBe(false);
    const result = installer.install({ packageId: 'com.vestara.typescript-skill' });
    expect(result.status).toBe('enabled');
    expect(registry.isInstalled('com.vestara.typescript-skill')).toBe(true);
  });

  it('requires approval for high-risk permissions', () => {
    const { installer, registry } = buildPlatform();
    // Grant the github package a workflow.execute permission (already in manifest).
    const review = installer.review({ packageId: 'com.vestara.github' });
    expect(review.permissions.requireApproval).toContain('workflow.execute');
    expect(review.approvalRequired).toBe(true);
    expect(() => installer.install({ packageId: 'com.vestara.github' })).toThrow(/requires approval/);
  });
});

describe('MKT-016..019 lifecycle', () => {
  it('enables, disables, updates and rolls back', () => {
    const { installer, lifecycle, registry } = buildPlatform();
    installer.install({ packageId: 'com.vestara.git-tools' });

    lifecycle.disable('com.vestara.git-tools');
    expect(registry.getInstalled('com.vestara.git-tools').enabled).toBe(false);

    lifecycle.enable('com.vestara.git-tools');
    expect(registry.getInstalled('com.vestara.git-tools').enabled).toBe(true);

    const update = lifecycle.update('com.vestara.git-tools');
    expect(['enabled', 'installed']).toContain(update.status);

    const rollback = lifecycle.rollback('com.vestara.git-tools');
    expect(rollback.to).toBeTruthy();

    lifecycle.uninstall('com.vestara.git-tools');
    expect(registry.isInstalled('com.vestara.git-tools')).toBe(false);
  });
});

describe('MKT-020 contribution registry', () => {
  it('registers package contributions', () => {
    const contributions = new MarketplaceContributionRegistry();
    contributions.register({ packageId: 'com.vestara.github', packageVersion: '2.4.1', tools: [{ id: 'github.create-pr', name: 'Create PR' }], permissions: ['repository.read'] });
    expect(contributions.byPackage('com.vestara.github')).toHaveLength(1);
    expect(contributions.list()[0]!.tools![0]!.id).toBe('github.create-pr');
  });
});
