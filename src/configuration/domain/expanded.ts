/** CONFIG-009..016 — expanded Configuration contracts. */

export type ConfigurationValueType =
  | 'string' | 'number' | 'integer' | 'boolean' | 'enum' | 'color' | 'json'
  | 'object' | 'array' | 'secret' | 'expression' | 'asset';

export type ReloadBehavior = 'immediate' | 'hot-reload' | 'service-restart' | 'system-reboot';

export type ConfigurationRisk = 'low' | 'medium' | 'high' | 'critical';

/** CONFIG-009 — rich field metadata driving UI + governance + restart behavior. */
export interface ConfigurationFieldDefinition {
  readonly key: string;
  readonly title: string;
  readonly description?: string;
  readonly type: ConfigurationValueType;
  readonly defaultValue?: unknown;
  readonly required?: boolean;
  readonly secret?: boolean;
  readonly immutable?: boolean;
  readonly reloadBehavior: ReloadBehavior;
  readonly risk: ConfigurationRisk;
  readonly enumValues?: readonly string[];
  readonly ui?: Readonly<Record<string, unknown>>;
}

export interface ConfigurationContribution {
  readonly packageId: string;
  readonly namespace: string;
  readonly version: string;
  readonly fields: readonly ConfigurationFieldDefinition[];
  readonly defaults?: Readonly<Record<string, unknown>>;
  readonly migrations?: readonly { fromVersion: number; toVersion: number; script: (values: Record<string, unknown>) => Record<string, unknown> }[];
  readonly presets?: readonly ConfigurationPreset[];
}

export interface ConfigurationPreset {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly patch: Readonly<Record<string, unknown>>;
}

/** CONFIG-012 — explicit scope hierarchy. */
export type ConfigurationScopeType =
  | 'default' | 'system' | 'environment' | 'organization' | 'workspace' | 'project'
  | 'application' | 'module' | 'service' | 'runtime' | 'session';

export interface ConfigurationScopeRef {
  readonly type: ConfigurationScopeType;
  readonly id?: string;
  readonly parent?: ConfigurationScopeRef;
}

export const CONFIG_SCOPE_PRECEDENCE: readonly ConfigurationScopeType[] = [
  'default', 'system', 'environment', 'organization', 'workspace', 'project',
  'application', 'module', 'service', 'runtime', 'session',
];

/** CONFIG-013 — provenance: where did this value come from? */
export interface ConfigurationProvenanceEntry {
  readonly key: string;
  readonly effectiveValue: unknown;
  readonly source: ConfigurationScopeType;
  readonly inherited: readonly { scope: ConfigurationScopeType; value?: unknown }[];
}

export interface ConfigurationProvenance {
  readonly scope: ConfigurationScopeRef;
  readonly entries: readonly ConfigurationProvenanceEntry[];
}

/** CONFIG-014 — atomic multi-key transaction. */
export interface ConfigurationChange {
  readonly key: string;
  readonly from: unknown;
  readonly to: unknown;
}

export type ConfigurationTransactionStatus = 'draft' | 'validated' | 'impacted' | 'awaiting-approval' | 'applying' | 'committed' | 'failed' | 'rolled-back';

export interface ConfigurationTransaction {
  readonly id: string;
  readonly scope: ConfigurationScopeRef;
  readonly changes: readonly ConfigurationChange[];
  readonly status: ConfigurationTransactionStatus;
  readonly createdAt: string;
  readonly appliedAt?: string;
  readonly impact?: ConfigurationImpact;
  readonly error?: string;
}

/** CONFIG-015 — operational impact of a change. */
export interface ConfigurationImpact {
  readonly affectedModules: readonly string[];
  readonly affectedServices: readonly string[];
  readonly requiredPermissions: readonly string[];
  readonly requiredRestarts: readonly string[];
  readonly requiresRegeneration: readonly string[];
  readonly requiresReboot: boolean;
  readonly risk: ConfigurationRisk;
  readonly summary: string;
}
