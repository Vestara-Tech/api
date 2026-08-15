import type { PackageContribution } from '../contracts/package.js';

export interface ContributionRegistry {
  register(contribution: PackageContribution): void;
  list(): readonly PackageContribution[];
  byPackage(packageId: string): PackageContribution[];
}

/**
 * MKT-020 — Contribution registration. Installing a package registers its
 * agents/tools/skills/workflows/modules/generators/permissions/capabilities
 * with the platform modules. Marketplace never needs to understand a package's
 * implementation.
 */
export class MarketplaceContributionRegistry implements ContributionRegistry {
  private readonly contributions = new Map<string, PackageContribution[]>();

  register(contribution: PackageContribution): void {
    const list = this.contributions.get(contribution.packageId) ?? [];
    list.push(contribution);
    this.contributions.set(contribution.packageId, list);
  }

  list(): readonly PackageContribution[] {
    return [...this.contributions.values()].flat();
  }

  byPackage(packageId: string): PackageContribution[] {
    return this.contributions.get(packageId) ?? [];
  }
}
