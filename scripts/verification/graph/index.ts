export { parseVerificationGraph } from './parser.ts';
export { normalizeVerificationGraph, resolveModuleId } from './normalize.ts';
export { buildVerificationGraph, validateVerificationGraph } from './validator.ts';
export { dependencyClosure, findOwningModule, moduleTests, ownedDependencies, canonicalModuleId } from './closure.ts';
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
