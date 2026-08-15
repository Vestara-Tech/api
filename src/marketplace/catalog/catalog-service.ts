import type { VestaraPackage, VestaraPackageKind } from '../contracts/package.js';
import { LocalPackageRegistry } from '../registry/local-package-registry.js';

export interface PackageSearchQuery {
  readonly search?: string;
  readonly kind?: VestaraPackageKind;
  readonly category?: string;
  readonly installed?: boolean;
}

export interface CatalogService {
  list(): readonly VestaraPackage[];
  get(id: string): VestaraPackage;
  search(query: PackageSearchQuery): readonly VestaraPackage[];
  categories(): readonly { name: string; count: number }[];
}

/**
 * MKT-005/007 — Catalog service. Supports search/filter/sort and category
 * listing over the local catalog (built-in + registry sources). Offline
 * operation works because the local registry is authoritative.
 */
export class MarketplaceCatalogService implements CatalogService {
  private readonly registry: LocalPackageRegistry;

  constructor(registry: LocalPackageRegistry) {
    this.registry = registry;
  }

  list(): readonly VestaraPackage[] {
    return this.registry.listAvailable();
  }

  get(id: string): VestaraPackage {
    return this.registry.get(id);
  }

  search(query: PackageSearchQuery): readonly VestaraPackage[] {
    let items = this.registry.listAvailable();
    if (query.installed === true) {
      items = items.filter((p) => this.registry.isInstalled(p.id));
    }
    if (query.kind) items = items.filter((p) => p.kind === query.kind);
    if (query.category) items = items.filter((p) => p.kind === query.category);
    if (query.search) {
      const needle = query.search.toLowerCase();
      items = items.filter((p) => p.name.toLowerCase().includes(needle) || p.id.toLowerCase().includes(needle) || (p.manifest.description ?? '').toLowerCase().includes(needle));
    }
    return [...items].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.name.localeCompare(b.name));
  }

  categories(): readonly { name: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const pkg of this.registry.listAvailable()) {
      counts.set(pkg.kind, (counts.get(pkg.kind) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
  }
}
