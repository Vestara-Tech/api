/** MKT-001/002/003 — Marketplace package contracts. */

export type VestaraPackageKind =
  | 'app'
  | 'module'
  | 'agent'
  | 'skill'
  | 'tool'
  | 'workflow'
  | 'integration'
  | 'generator'
  | 'builder'
  | 'ai-provider'
  | 'model-provider'
  | 'database-provider'
  | 'template'
  | 'theme'
  | 'standards-pack'
  | 'os-component'
  | 'knowledge-pack';

export interface PackagePublisher {
  readonly id: string;
  readonly name: string;
  readonly verified: boolean;
}

export interface PackageManifest {
  readonly schemaVersion: string;
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly kind: VestaraPackageKind;
  readonly publisher: string;
  readonly entrypoint?: string;
  readonly description?: string;
  readonly vestara?: { readonly api?: string; readonly platform?: string };
  readonly notifications?: readonly { readonly event: string; readonly category: string; readonly defaultDelivery?: readonly string[] }[];
}

export interface PackageDependency {
  readonly packageId: string;
  readonly versionRange: string;
  readonly required: boolean;
}

export interface PackagePermission {
  readonly id: string;
  readonly required: boolean;
  readonly approval?: 'auto' | 'explicit';
}

export interface PackageCapability {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly optional?: boolean;
}

export interface PackageCompatibility {
  readonly apiRange?: string;
  readonly platformRange?: string;
  readonly os?: readonly string[];
  readonly architectures?: readonly string[];
  readonly nodeRange?: string;
  readonly requires?: readonly { module: string; range: string }[];
  readonly conflicts?: readonly string[];
}

export interface PackageArtifact {
  readonly path: string;
  readonly kind: string;
  readonly sha256: string;
  readonly size?: number;
}

export interface PackageProvenance {
  readonly source: string;
  readonly signature?: string;
  readonly signer?: string;
  readonly verified: boolean;
  readonly publishedAt: string;
}

export interface VestaraPackage {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly kind: VestaraPackageKind;
  readonly publisher: PackagePublisher;
  readonly manifest: PackageManifest;
  readonly dependencies: readonly PackageDependency[];
  readonly permissions: readonly PackagePermission[];
  readonly capabilities: readonly PackageCapability[];
  readonly compatibility: PackageCompatibility;
  readonly artifacts: readonly PackageArtifact[];
  readonly provenance: PackageProvenance;
  readonly installs?: number;
  readonly rating?: number;
}

export type PackageLifecycleStatus =
  | 'available'
  | 'resolving'
  | 'downloading'
  | 'verifying'
  | 'awaiting-permission'
  | 'installing'
  | 'installed'
  | 'enabling'
  | 'enabled'
  | 'running'
  | 'disabled'
  | 'update-available'
  | 'updating'
  | 'rollback-available'
  | 'failed'
  | 'incompatible'
  | 'quarantined'
  | 'uninstalling';

export interface InstalledPackage {
  readonly packageId: string;
  readonly version: string;
  readonly status: PackageLifecycleStatus;
  readonly installedAt: string;
  readonly enabled: boolean;
  readonly permissions: readonly PackagePermission[];
  readonly knownGoodVersion?: string;
  readonly updatedAt?: string;
}

/** MKT-004 — package contribution registration. */
export interface PackageContribution {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly agents?: readonly { id: string; name: string }[];
  readonly skills?: readonly { id: string; name: string }[];
  readonly tools?: readonly { id: string; name: string }[];
  readonly workflows?: readonly { id: string; name: string }[];
  readonly generators?: readonly { id: string; name: string }[];
  readonly modules?: readonly { id: string; name: string }[];
  readonly permissions?: readonly string[];
  readonly capabilities?: readonly string[];
}
