import { randomId } from '../../core/identifiers.js';
import { hashOf } from '../../generator/domain/hash.js';
import type { DistributionDefinition, PackageBundle } from './contracts.js';

export interface BundleStorePort {
  saveBundle(bundle: PackageBundle): void;
  getBundle(id: string): PackageBundle | undefined;
  listBundles(): readonly PackageBundle[];
  saveDistribution(distribution: DistributionDefinition): void;
  getDistribution(id: string): DistributionDefinition | undefined;
  listDistributions(): readonly DistributionDefinition[];
}

export class InMemoryDistributionStore implements BundleStorePort {
  private readonly bundles = new Map<string, PackageBundle>();
  private readonly distributions = new Map<string, DistributionDefinition>();

  saveBundle(bundle: PackageBundle): void {
    this.bundles.set(bundle.bundleId, bundle);
  }

  getBundle(id: string): PackageBundle | undefined {
    return this.bundles.get(id);
  }

  listBundles(): readonly PackageBundle[] {
    return [...this.bundles.values()];
  }

  saveDistribution(distribution: DistributionDefinition): void {
    this.distributions.set(distribution.distributionId, distribution);
  }

  getDistribution(id: string): DistributionDefinition | undefined {
    return this.distributions.get(id);
  }

  listDistributions(): readonly DistributionDefinition[] {
    return [...this.distributions.values()];
  }
}

/** MKT2-004/005 — Bundles group packages; distributions curate a Vestara configuration. */
export class MarketplaceDistributionService {
  private readonly store: BundleStorePort;

  constructor(store: BundleStorePort = new InMemoryDistributionStore()) {
    this.store = store;
  }

  createBundle(input: Omit<PackageBundle, 'bundleId'>): PackageBundle {
    const bundle: PackageBundle = { ...input, bundleId: `bundle_${randomId('b').slice(6, 12)}` };
    this.store.saveBundle(bundle);
    return bundle;
  }

  createDistribution(input: Omit<DistributionDefinition, 'distributionId'>): DistributionDefinition {
    const distribution: DistributionDefinition = { ...input, distributionId: `dist_${randomId('d').slice(6, 12)}` };
    this.store.saveDistribution(distribution);
    return distribution;
  }

  /** Install plan for a distribution: required packages + recommended + optional + AI. */
  planDistribution(id: string): { required: string[]; recommended: string[]; optional: string[]; ai: string[]; total: number } {
    const distribution = this.store.getDistribution(id);
    if (!distribution) throw new Error(`Distribution "${id}" not found`);
    const required = [...distribution.packages.filter((p) => p.required).map((p) => p.packageId)];
    const optional = distribution.packages.filter((p) => !p.required).map((p) => p.packageId);
    const recommended: string[] = [];
    const ai = [...(distribution.ai ?? [])];
    for (const bundleRef of distribution.bundles) {
      const bundle = this.store.getBundle(bundleRef.bundleId);
      if (!bundle) continue;
      if (bundleRef.required) required.push(...bundle.packages.map((p) => p.packageId));
      recommended.push(...bundle.recommended.map((p) => p.packageId));
      optional.push(...bundle.optional.map((p) => p.packageId));
      ai.push(...(bundle.ai ?? []));
    }
    const unique = (list: string[]): string[] => [...new Set(list)];
    const dedupedRequired = unique(required);
    const total = dedupedRequired.length + unique(recommended).length + unique(optional).length;
    return { required: dedupedRequired, recommended: unique(recommended), optional: unique(optional), ai: unique(ai), total };
  }

  listBundles(): readonly PackageBundle[] {
    return this.store.listBundles();
  }

  listDistributions(): readonly DistributionDefinition[] {
    return this.store.listDistributions();
  }
}

/** MKT2-012 — Package signing. Deterministic signature over package identity. */
export function signPackage(input: { packageId: string; version: string; signer: string; keyId: string }): { signature: string; signer: string; signedAt: string } {
  const payload = hashOf({ packageId: input.packageId, version: input.version, signer: input.signer, keyId: input.keyId });
  return { signature: `sig-${payload}`, signer: input.signer, signedAt: new Date().toISOString() };
}

/** MKT2-013 — Security scan result. */
export interface SecurityScanResult {
  readonly scanId: string;
  readonly packageId: string;
  readonly version: string;
  readonly findings: readonly { severity: 'critical' | 'high' | 'medium' | 'low' | 'info'; message: string }[];
  readonly blocked: boolean;
  readonly scannedAt: string;
}

export function runSecurityScan(packageId: string, version: string, findings: SecurityScanResult['findings']): SecurityScanResult {
  return {
    scanId: randomId('scan'),
    packageId,
    version,
    findings,
    blocked: findings.some((f) => f.severity === 'critical' || f.severity === 'high'),
    scannedAt: new Date().toISOString(),
  };
}

/** MKT2-014 — Evidence bundle for a published package. */
export interface PackageEvidence {
  readonly packageId: string;
  readonly version: string;
  readonly buildId: string;
  readonly securityScanId: string;
  readonly compatibilityHash: string;
  readonly signature: string;
  readonly signer: string;
  readonly evidenceHash: string;
  readonly at: string;
}

export function buildPackageEvidence(input: Omit<PackageEvidence, 'evidenceHash' | 'at'>): PackageEvidence {
  return {
    ...input,
    evidenceHash: hashOf({ packageId: input.packageId, version: input.version, buildId: input.buildId, securityScanId: input.securityScanId, compatibilityHash: input.compatibilityHash, signature: input.signature, signer: input.signer }),
    at: new Date().toISOString(),
  };
}
