import type { SystemCompatibilityContext } from '../marketplace/compatibility/compatibility-analyzer.js';
import { LocalPackageRegistry } from '../marketplace/registry/local-package-registry.js';
import { builtinCatalog } from '../marketplace/catalog/builtin-catalog.js';
import { MarketplaceCatalogService } from '../marketplace/catalog/catalog-service.js';
import { DependencyResolver } from '../marketplace/resolver/dependency-resolver.js';
import { CompatibilityAnalyzer } from '../marketplace/compatibility/compatibility-analyzer.js';
import { PermissionAnalyzer } from '../marketplace/security/permission-analyzer.js';
import { InstallationService } from '../marketplace/installation/installation-service.js';
import { PackageLifecycleService } from '../marketplace/lifecycle/package-lifecycle-service.js';
import { MarketplaceContributionRegistry } from '../marketplace/contribution/contribution-registry.js';

export interface MarketplacePlatformOptions {
  readonly systemContext?: SystemCompatibilityContext;
}

export interface MarketplacePlatform {
  readonly registry: LocalPackageRegistry;
  readonly catalog: MarketplaceCatalogService;
  readonly dependencies: DependencyResolver;
  readonly compatibility: CompatibilityAnalyzer;
  readonly permissions: PermissionAnalyzer;
  readonly installer: InstallationService;
  readonly lifecycle: PackageLifecycleService;
  readonly contributions: MarketplaceContributionRegistry;
}

/** MKT — Composition root. Seeds the built-in (offline) catalog. */
export function buildMarketplacePlatform(options: MarketplacePlatformOptions = {}): MarketplacePlatform {
  const registry = new LocalPackageRegistry();
  for (const pkg of builtinCatalog()) registry.catalog(pkg);

  const catalog = new MarketplaceCatalogService(registry);
  const dependencies = new DependencyResolver(registry);
  const compatibility = new CompatibilityAnalyzer();
  const permissions = new PermissionAnalyzer();
  const systemContext: SystemCompatibilityContext = options.systemContext ?? {
    apiVersion: '2.4.0',
    platformVersion: '1.8.0',
    os: 'linux',
    architecture: 'x64',
    nodeVersion: '22.0.0',
    moduleVersions: { 'vestara.integration': '2.1.0', 'vestara.permission': '1.0.0' },
  };
  const installer = new InstallationService({ registry, dependencies, compatibility, permissions, systemContext });
  const lifecycle = new PackageLifecycleService(registry);
  const contributions = new MarketplaceContributionRegistry();

  return { registry, catalog, dependencies, compatibility, permissions, installer, lifecycle, contributions };
}
