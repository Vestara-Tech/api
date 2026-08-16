import type { ContributionRegistryV2 } from './contributions.js';
import type { PackageVersionEntry } from './versioning.js';
import { satisfies } from '../resolver/dependency-resolver.js';

export interface PackageDependencyEdge {
  readonly packageId: string;
  readonly versionRange: string;
  readonly required: boolean;
}

export interface ReverseDependency {
  readonly dependent: string;
  readonly versionRange: string;
  readonly stillSatisfied: boolean;
}

export interface UpdateImpact {
  readonly packageId: string;
  readonly fromVersion: string;
  readonly toVersion: string;
  readonly breaking: boolean;
  readonly reverseDependencies: readonly ReverseDependency[];
  readonly capabilitiesAdded: readonly string[];
  readonly capabilitiesRemoved: readonly string[];
}

export interface ImpactAnalysisOptions {
  readonly registry: ContributionRegistryV2;
  /** Package -> dependency edges. Which installed packages depend on what. */
  readonly dependentsOf: (packageId: string) => readonly PackageDependencyEdge[];
}

/**
 * MKT2-020 — Dependency impact analysis. Before updating a package, find every
 * installed package that depends on it, verify their version ranges still hold
 * against the target version, and surface capability changes from the updated
 * manifest so the update decision is evidence-driven.
 */
export class DependencyImpactAnalyzer {
  private readonly options: ImpactAnalysisOptions;

  constructor(options: ImpactAnalysisOptions) {
    this.options = options;
  }

  analyze(currentVersion: string, target: PackageVersionEntry): UpdateImpact {
    const { registry, dependentsOf } = this.options;
    const reverse = dependentsOf(target.packageId).map((edge) => ({
      dependent: edge.packageId,
      versionRange: edge.versionRange,
      stillSatisfied: edge.versionRange === '*' || satisfies(target.version, edge.versionRange),
    }));

    const current = registry.contributions().find((c) => c.packageId === target.packageId);
    const currentRequires = new Set((current?.manifest.requires ?? []).map((r) => r.capability ?? r.module));
    const targetManifest = registry.contributions().find((c) => c.packageId === target.packageId);
    const targetRequires = new Set((targetManifest?.manifest.requires ?? []).map((r) => r.capability ?? r.module));

    const capabilitiesAdded = [...targetRequires].filter((c) => !currentRequires.has(c));
    const capabilitiesRemoved = [...currentRequires].filter((c) => !targetRequires.has(c));

    const breaking = reverse.some((r) => !r.stillSatisfied) || capabilitiesRemoved.length > 0;
    return {
      packageId: target.packageId,
      fromVersion: currentVersion,
      toVersion: target.version,
      breaking,
      reverseDependencies: reverse,
      capabilitiesAdded,
      capabilitiesRemoved,
    };
  }
}
