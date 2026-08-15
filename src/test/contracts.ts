/** Expanded Test contracts — TEST-001/002/003/004/006/016. */

export type TestType =
  | 'unit' | 'component' | 'integration' | 'contract' | 'api' | 'database' | 'migration' | 'workflow'
  | 'agent' | 'tool' | 'skill' | 'browser' | 'visual' | 'accessibility' | 'performance' | 'load'
  | 'stress' | 'security' | 'compatibility' | 'installation' | 'upgrade' | 'recovery' | 'system'
  | 'boot' | 'smoke' | 'acceptance' | 'regression' | 'chaos' | 'custom';

export type TestTargetType =
  | 'module' | 'service' | 'application' | 'package' | 'api' | 'endpoint' | 'database' | 'workflow'
  | 'agent' | 'tool' | 'skill' | 'integration' | 'generator' | 'artifact' | 'os-image' | 'system'
  | 'repository' | 'custom';

export interface TestRequirement {
  readonly id: string;
  readonly description: string;
  readonly required: boolean;
}

export interface ArtifactRequirement {
  readonly id: string;
  readonly kind: string;
  readonly required: boolean;
}

export interface EvidenceRequirement {
  readonly id: string;
  readonly kind: string;
  readonly required: boolean;
}

export interface TestDefinition {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly type: TestType;
  readonly target: TestTargetType;
  readonly runnerId: string;
  readonly requirements: readonly TestRequirement[];
  readonly parameters: Readonly<Record<string, unknown>>;
  readonly timeoutMs?: number;
  readonly retries?: number;
  readonly tags: readonly string[];
  readonly artifactRequirements: readonly ArtifactRequirement[];
  readonly evidenceRequirements: readonly EvidenceRequirement[];
  readonly metadata: Readonly<Record<string, unknown>>;
}

export interface TestSuite {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly tests: readonly TestDefinition[];
  readonly createdAt: string;
}

export interface TestProfile {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly types: readonly TestType[];
  readonly tags: readonly string[];
  readonly coverageThreshold?: number;
  readonly timeoutSeconds?: number;
  readonly environments?: readonly string[];
}

/** TEST-003 — a test plan selects suites/tests under a profile to prove an objective. */
export interface TestPlan {
  readonly id: string;
  readonly name: string;
  readonly objective: string;
  readonly target: string;
  readonly suiteIds: readonly string[];
  readonly profileId: string;
  readonly coverageThreshold?: number;
  readonly required?: readonly string[];
  readonly createdAt: string;
}

/** TEST-021 — discovery result. */
export interface TestDiscoveryResult {
  readonly target: string;
  readonly frameworks: readonly string[];
  readonly suites: number;
  readonly tests: number;
  readonly capabilities: readonly TestType[];
}

/** TEST-016 — normalized result. */
export interface NormalizedTestCaseResult {
  readonly testId: string;
  readonly status: 'passed' | 'failed' | 'skipped' | 'timed_out' | 'cancelled' | 'indeterminate';
  readonly durationMs: number;
  readonly attempt: number;
  readonly error?: string;
  readonly artifactIds: readonly string[];
  readonly logIds: readonly string[];
}

export interface TestExecution {
  readonly executionId: string;
  readonly testId: string;
  readonly status: NormalizedTestCaseResult['status'];
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly attempt: number;
}

export interface TestRun {
  readonly id: string;
  readonly planId: string;
  readonly profileId: string;
  readonly target: string;
  readonly status: 'created' | 'queued' | 'preparing' | 'running' | 'failed' | 'cancelled' | 'collecting' | 'evaluating' | 'finalized';
  readonly executions: readonly TestExecution[];
  readonly results: readonly NormalizedTestCaseResult[];
  readonly summary: { total: number; passed: number; failed: number; skipped: number };
  readonly coverage?: CoverageReport;
  readonly artifacts: readonly string[];
  readonly logs: readonly string[];
  readonly evidenceId?: string;
  readonly queuedAt?: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
}

/** TEST-018 — coverage. */
export interface CoverageFile {
  readonly path: string;
  readonly lines: number;
  readonly branches: number;
  readonly functions: number;
  readonly statements: number;
}

export interface CoverageReport {
  readonly lines: number;
  readonly branches: number;
  readonly functions: number;
  readonly statements: number;
  readonly files: readonly CoverageFile[];
  readonly baseline?: number;
  readonly delta?: number;
  readonly thresholds?: number;
}

/** TEST-019 — flaky analysis. */
export interface TestHistoryEntry {
  readonly testId: string;
  readonly status: NormalizedTestCaseResult['status'];
  readonly at: string;
}

export interface FlakinessResult {
  readonly testId: string;
  readonly runs: number;
  readonly passed: number;
  readonly failed: number;
  readonly retried: number;
  readonly flakiness: number;
  readonly confidence: 'low' | 'medium' | 'high';
  readonly classification: string;
}

/** TEST-020 — baseline/regression. */
export type RegressionComparison = 'improvement' | 'unchanged' | 'regression' | 'incomparable';

export interface Baseline {
  readonly id: string;
  readonly name: string;
  readonly target: string;
  readonly passed: number;
  readonly total: number;
  readonly coverage?: CoverageReport;
  readonly recordedAt: string;
}

export interface RegressionResult {
  readonly testId: string;
  readonly comparison: RegressionComparison;
  readonly message: string;
}

/** TEST-022 — impact analysis. */
export interface ImpactAnalysis {
  readonly changedArtifacts: readonly string[];
  readonly affectedCapabilities: readonly string[];
  readonly affectedTests: readonly string[];
  readonly recommendedTestCount: number;
}

/** TEST-023 — evidence bundle. */
export interface TestEvidenceBundle {
  readonly definitionHash: string;
  readonly planHash: string;
  readonly sourceRevision: string;
  readonly environment: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly results: readonly NormalizedTestCaseResult[];
  readonly coverage?: CoverageReport;
  readonly artifacts: readonly string[];
  readonly logs: readonly string[];
  readonly evidenceHash: string;
}
