import type { ContributionManifestV2, VestaraPackageKind } from './contracts.js';

export interface ContributionRegistryV2Port {
  register(packageId: string, version: string, manifest: ContributionManifestV2): void;
  unregister(packageId: string): void;
  contributions(): readonly { packageId: string; version: string; manifest: ContributionManifestV2 }[];
  provides(kind: VestaraPackageKind): readonly { packageId: string; id: string; name: string; version?: string }[];
  providesById(id: string): readonly { packageId: string; kind: VestaraPackageKind; name: string; version?: string }[];
}

/**
 * MKT2-002 — Contribution registry v2. Packages declare `provides`/`requires`/
 * `optional` contributions explicitly; installing registers them, disabling
 * removes them. Marketplace distributes; modules execute.
 */
export class ContributionRegistryV2 implements ContributionRegistryV2Port {
  private readonly entries = new Map<string, { packageId: string; version: string; manifest: ContributionManifestV2 }>();

  register(packageId: string, version: string, manifest: ContributionManifestV2): void {
    this.entries.set(packageId, { packageId, version, manifest });
  }

  unregister(packageId: string): void {
    this.entries.delete(packageId);
  }

  contributions(): readonly { packageId: string; version: string; manifest: ContributionManifestV2 }[] {
    return [...this.entries.values()];
  }

  provides(kind: VestaraPackageKind): readonly { packageId: string; id: string; name: string; version?: string }[] {
    return [...this.entries.values()].flatMap((entry) =>
      entry.manifest.provides.filter((p) => p.kind === kind).map((p) => ({ packageId: entry.packageId, id: p.id, name: p.name, ...(p.version !== undefined ? { version: p.version } : {}) })),
    );
  }

  providesById(id: string): readonly { packageId: string; kind: VestaraPackageKind; name: string; version?: string }[] {
    return [...this.entries.values()].flatMap((entry) =>
      entry.manifest.provides.filter((p) => p.id === id).map((p) => ({ packageId: entry.packageId, kind: p.kind, name: p.name, ...(p.version !== undefined ? { version: p.version } : {}) })),
    );
  }
}

export interface CapabilityResolverOptions {
  readonly registry: ContributionRegistryV2;
  readonly isModuleEnabled: (moduleId: string) => boolean;
  readonly isCapabilityPresent: (capability: string) => boolean;
}

export interface CapabilityResolutionIssue {
  readonly module: string;
  readonly capability?: string;
  readonly required: boolean;
  readonly satisfied: boolean;
}

export interface CapabilityResolution {
  readonly ok: boolean;
  readonly issues: readonly CapabilityResolutionIssue[];
  readonly missingRequired: readonly string[];
}

/**
 * MKT2-003 — Capability-aware dependency resolver. Resolves package deps +
 * capability deps + module deps + optional deps against the enabled platform.
 */
export class CapabilityResolver {
  private readonly registry: ContributionRegistryV2;
  private readonly isModuleEnabled: (moduleId: string) => boolean;
  private readonly isCapabilityPresent: (capability: string) => boolean;

  constructor(options: CapabilityResolverOptions) {
    this.registry = options.registry;
    this.isModuleEnabled = options.isModuleEnabled;
    this.isCapabilityPresent = options.isCapabilityPresent;
  }

  resolve(manifest: ContributionManifestV2): CapabilityResolution {
    const issues: CapabilityResolutionIssue[] = [];
    const missingRequired: string[] = [];

    for (const requirement of manifest.requires) {
      const moduleEnabled = this.isModuleEnabled(requirement.module);
      const capabilityOk = requirement.capability === undefined || this.isCapabilityPresent(requirement.capability);
      const satisfied = moduleEnabled && capabilityOk;
      issues.push({ module: requirement.module, ...(requirement.capability !== undefined ? { capability: requirement.capability } : {}), required: true, satisfied });
      if (!satisfied) missingRequired.push(requirement.capability ?? requirement.module);
    }

    for (const optional of manifest.optional) {
      const moduleEnabled = this.isModuleEnabled(optional.module);
      const capabilityOk = optional.capability === undefined || this.isCapabilityPresent(optional.capability);
      issues.push({ module: optional.module, ...(optional.capability !== undefined ? { capability: optional.capability } : {}), required: false, satisfied: moduleEnabled && capabilityOk });
    }

    return { ok: missingRequired.length === 0, issues, missingRequired };
  }
}
