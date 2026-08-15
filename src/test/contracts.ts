/** TEST-001/002/003/004 — Test Module contracts. */

export type TestKind =
  | 'unit' | 'integration' | 'component' | 'api' | 'contract' | 'database' | 'workflow'
  | 'agent' | 'tool' | 'skill' | 'system' | 'e2e' | 'visual' | 'smoke' | 'regression' | 'performance';

export type TestTargetKind = 'module' | 'api' | 'workflow' | 'agent' | 'database' | 'browser' | 'system' | 'generator';

export interface TestRetryPolicy {
  readonly maxAttempts: number;
  readonly backoffMs: number;
}

export interface TestDefinition {
  readonly id: string;
  readonly name: string;
  readonly kind: TestKind;
  readonly target: TestTargetKind;
  readonly runner: string;
  readonly configuration: Readonly<Record<string, unknown>>;
  readonly requirements: readonly string[];
  readonly tags: readonly string[];
  readonly timeoutMs?: number;
  readonly retry?: TestRetryPolicy;
}

export interface TestSuite {
  readonly id: string;
  readonly name: string;
  readonly tests: readonly TestDefinition[];
  readonly createdAt: string;
}

export type TestRunStatus = 'created' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'error';

export interface AssertionResult {
  readonly id: string;
  readonly name: string;
  readonly passed: boolean;
  readonly message?: string;
  readonly durationMs?: number;
}

export interface TestRun {
  readonly id: string;
  readonly suiteId: string;
  readonly status: TestRunStatus;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly results: readonly { testId: string; name: string; status: 'passed' | 'failed' | 'skipped' | 'error'; assertions?: readonly AssertionResult[]; durationMs?: number; error?: string }[];
  readonly evidenceHash: string;
  readonly runner: string;
}

/** TEST-005 — TestRunner port. */
export interface TestRunnerContext {
  readonly runId: string;
  readonly workspace?: string;
  readonly env: Readonly<Record<string, unknown>>;
}

export interface TestRunner {
  readonly id: string;
  readonly supportedKinds: readonly TestKind[];
  run(suite: TestSuite, context: TestRunnerContext): Promise<TestRun>;
}

/** TEST-007 — contribution contract. */
export interface TestRunnerContribution {
  readonly id: string;
  readonly moduleId: string;
  readonly version: string;
  readonly supportedKinds: readonly TestKind[];
  readonly capabilities: readonly string[];
  createRunner(): TestRunner;
}
