declare const moduleIdBrand: unique symbol;

export type ModuleId = string & { readonly [moduleIdBrand]: 'ModuleId' };

export type GraphSeverity = 'error' | 'warning' | 'info';

export interface GraphIssue {
  readonly code: string;
  readonly severity: GraphSeverity;
  readonly message: string;
  readonly module?: string;
  readonly dependency?: string;
  readonly alias?: string;
  readonly path?: string;
}

export interface ParsedVerificationModule {
  readonly id: string;
  readonly sources: readonly string[];
  readonly tests: readonly string[];
  readonly dependsOn: readonly string[];
  readonly cwd?: string;
}

export interface ParsedVerificationGraph {
  readonly modules: readonly ParsedVerificationModule[];
  readonly aliases: ReadonlyMap<string, string>;
}

export interface NormalizedVerificationModule {
  readonly id: ModuleId;
  readonly rawId: string;
  readonly sources: readonly string[];
  readonly tests: readonly string[];
  readonly dependsOn: readonly ModuleId[];
  readonly cwd?: string;
}

export interface ValidatedVerificationGraph {
  readonly modules: ReadonlyMap<ModuleId, NormalizedVerificationModule>;
  readonly aliases: ReadonlyMap<string, ModuleId>;
  readonly dependencies: ReadonlyMap<ModuleId, ReadonlySet<ModuleId>>;
}

export interface GraphBuildResult {
  readonly graph: ValidatedVerificationGraph | null;
  readonly issues: readonly GraphIssue[];
  readonly valid: boolean;
}

export function toModuleId(value: string): ModuleId {
  return value as ModuleId;
}
