import type { TestDiscoveryResult, TestProfile, TestSuite } from '../contracts.js';

export type { TestDiscoveryResult, TestProfile, TestSuite } from '../contracts.js';

export type TestRunnerCapability =
  | 'unit' | 'integration' | 'component' | 'api' | 'contract' | 'database' | 'browser' | 'visual'
  | 'performance' | 'security' | 'system' | 'os';

export interface TestDiscoveryContext {
  readonly target: string;
  readonly rootPath?: string;
  readonly configFiles?: readonly string[];
}

export interface TestExecutionRequest {
  readonly suite: TestSuite;
  readonly profile: TestProfile;
  readonly environment?: string;
  readonly apiBase?: string;
}

export interface TestExecutionPlan {
  readonly request: TestExecutionRequest;
  readonly tests: readonly string[];
  readonly estimatedSeconds?: number;
}

export interface TestExecutionResult {
  readonly results: readonly {
    readonly testId: string;
    readonly status: 'passed' | 'failed' | 'skipped' | 'timed_out' | 'cancelled' | 'indeterminate';
    readonly durationMs: number;
    readonly attempt: number;
    readonly error?: string;
  }[];
}

/** TEST-006 — expanded TestRunner contract (discover/plan/execute/cancel). */
export interface TestRunner {
  readonly id: string;
  readonly capabilities: readonly TestRunnerCapability[];
  discover(context: TestDiscoveryContext): Promise<TestDiscoveryResult>;
  plan(request: TestExecutionRequest): Promise<TestExecutionPlan>;
  execute(plan: TestExecutionPlan): Promise<TestExecutionResult>;
  cancel(executionId: string): Promise<void>;
}
