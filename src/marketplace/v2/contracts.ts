/** MKT2-001/002 — Extended package taxonomy + contribution manifest v2. */

export type VestaraPackageKind =
  | 'app'
  | 'module'
  | 'service'
  | 'integration'
  | 'ai-provider'
  | 'model-pack'
  | 'ai-profile'
  | 'routing-policy'
  | 'evaluator'
  | 'agent'
  | 'skill'
  | 'tool'
  | 'instruction-pack'
  | 'workflow'
  | 'task'
  | 'workflow-template'
  | 'api-builder'
  | 'agent-builder'
  | 'page-builder'
  | 'dashboard-builder'
  | 'database-builder'
  | 'os-builder'
  | 'generator'
  | 'component'
  | 'theme'
  | 'template'
  | 'page'
  | 'dashboard-pack'
  | 'database-driver'
  | 'schema'
  | 'knowledge-pack'
  | 'context-provider'
  | 'os-component'
  | 'boot-theme'
  | 'login-theme'
  | 'desktop-profile'
  | 'image-profile'
  | 'standards-pack'
  | 'test-pack'
  | 'diagnostics-pack'
  | 'developer-tool';

/** MKT2-002 — explicit contribution declarations. */
export interface ContributionManifestV2 {
  readonly provides: readonly {
    readonly kind: VestaraPackageKind;
    readonly id: string;
    readonly name: string;
    readonly version?: string;
    readonly description?: string;
  }[];
  readonly requires: readonly {
    readonly module: string;
    readonly range?: string;
    readonly capability?: string;
  }[];
  readonly optional: readonly {
    readonly module: string;
    readonly range?: string;
    readonly capability?: string;
  }[];
}

export interface PackageBundle {
  readonly bundleId: string;
  readonly name: string;
  readonly description?: string;
  readonly packages: readonly { packageId: string; versionRange?: string; required: boolean }[];
  readonly recommended: readonly { packageId: string; versionRange?: string }[];
  readonly optional: readonly { packageId: string; versionRange?: string }[];
  readonly ai?: readonly string[]; // recommended AI provider/profile ids
  readonly metadata: Readonly<Record<string, unknown>>;
}

export type DistributionChannel = 'stable' | 'beta' | 'development' | 'canary';

export interface DistributionDefinition {
  readonly distributionId: string;
  readonly name: string;
  readonly description?: string;
  readonly bundles: readonly { bundleId: string; required: boolean }[];
  readonly packages: readonly { packageId: string; required: boolean; channel?: DistributionChannel }[];
  readonly channel: DistributionChannel;
  readonly curatedBy: string;
  readonly ai?: readonly string[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export type TrustLevel = 'vestara-official' | 'verified-publisher' | 'community' | 'local' | 'development';

export interface PublisherIdentity {
  readonly publisherId: string;
  readonly name: string;
  readonly trustLevel: TrustLevel;
  readonly verified: boolean;
  readonly website?: string;
  readonly ownerUserId?: string;
  readonly organizationId?: string;
}
