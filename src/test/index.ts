export type {
  TestType,
  TestTargetType,
  TestRequirement,
  ArtifactRequirement,
  EvidenceRequirement,
  TestDefinition,
  TestSuite,
  TestProfile,
  TestPlan,
  TestDiscoveryResult,
  NormalizedTestCaseResult,
  TestExecution,
  TestRun,
  CoverageFile,
  CoverageReport,
  TestHistoryEntry,
  FlakinessResult,
  RegressionComparison,
  Baseline,
  RegressionResult,
  ImpactAnalysis,
  TestEvidenceBundle,
} from './contracts.js';
export type {
  TestRunnerCapability,
  TestDiscoveryContext,
  TestExecutionRequest,
  TestExecutionPlan,
  TestExecutionResult,
  TestRunner,
} from './runner/runner.js';
export { TestRunnerRegistry } from './registry/test-runner-registry.js';
export { VitestAdapter } from './adapters/vitest.js';
export { HttpTestAdapter } from './adapters/http.js';
export { buildTestRun, hashResults, buildEvidenceBundle } from './runtime/run-builder.js';
export { CoverageEngine } from './analysis/coverage.js';
export { FlakinessAnalyzer } from './analysis/flakiness.js';
export { BaselineEngine } from './analysis/baseline.js';
export { ImpactAnalyzer } from './analysis/impact.js';
export type { TestServiceOptions } from './service/test-service.js';
export { TestService } from './service/test-service.js';
