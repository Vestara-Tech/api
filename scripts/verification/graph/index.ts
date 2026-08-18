export { parseVerificationGraph } from './parser.ts';
export { normalizeVerificationGraph, resolveModuleId } from './normalize.ts';
export { buildVerificationGraph, validateVerificationGraph } from './validator.ts';
export { dependencyClosure, findOwningModule, moduleTests, ownedDependencies, canonicalModuleId } from './closure.ts';
export { buildOwnershipIndex, ownershipIssues } from './ownership.ts';
export type {
  GraphBuildResult,
  GraphIssue,
  GraphSeverity,
  ModuleId,
  NormalizedVerificationGraph,
  NormalizedVerificationModule,
  ParsedVerificationGraph,
  ParsedVerificationModule,
  ValidatedVerificationGraph,
} from './types.ts';
export type {
  OwnershipBucket,
  OwnershipDiscovery,
  OwnershipEntry,
  OwnershipIndex,
  OwnershipMode,
  ModuleOwnership,
  WorkspaceCoverage,
} from './ownership.ts';
