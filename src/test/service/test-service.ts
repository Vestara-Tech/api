import { randomId } from '../../core/identifiers.js';
import type { TestProfile, TestSuite, TestPlan, NormalizedTestCaseResult, TestRun, TestDefinition } from '../contracts.js';
import { TestRunnerRegistry } from '../registry/test-runner-registry.js';
import { buildTestRun } from '../runtime/run-builder.js';
import { FlakinessAnalyzer } from '../analysis/flakiness.js';
import { ImpactAnalyzer } from '../analysis/impact.js';

export interface TestServiceOptions {
  readonly registry: TestRunnerRegistry;
}

export interface TestService {
  createSuite(input: { id: string; name: string; tests: readonly TestDefinition[]; description?: string }): TestSuite;
  getSuite(id: string): TestSuite;
  listSuites(): readonly TestSuite[];
  createPlan(input: { id: string; name: string; objective: string; target: string; suiteIds: readonly string[]; profileId: string; required?: readonly string[] }): TestPlan;
  listPlans(): readonly TestPlan[];
  createProfile(profile: TestProfile): TestProfile;
  listProfiles(): readonly TestProfile[];
  run(suiteId: string, profileId: string, env?: Record<string, unknown>): Promise<TestRun>;
  readonly history: readonly NormalizedTestCaseResult[];
  flaky(testId: string): ReturnType<FlakinessAnalyzer['analyze']>;
  impact(input: Parameters<ImpactAnalyzer['analyze']>[0]): ReturnType<ImpactAnalyzer['analyze']>;
}

/**
 * TEST — Expanded Test service. Orchestrates suites, plans, profiles and
 * runners; normalizes results; tracks history for flaky analysis. A testing
 * platform, not a Vitest wrapper.
 */
export class TestService implements TestService {
  private readonly registry: TestRunnerRegistry;
  private readonly suites = new Map<string, TestSuite>();
  private readonly plans = new Map<string, TestPlan>();
  private readonly profiles = new Map<string, TestProfile>();
  private readonly runs = new Map<string, TestRun>();
  private readonly historyRecords: NormalizedTestCaseResult[] = [];
  private readonly flakiness = new FlakinessAnalyzer();

  constructor(options: TestServiceOptions) {
    this.registry = options.registry;
  }

  createSuite(input: { id: string; name: string; tests: readonly TestDefinition[]; description?: string }): TestSuite {
    const suite: TestSuite = { id: input.id, name: input.name, tests: input.tests, createdAt: new Date().toISOString(), ...(input.description !== undefined ? { description: input.description } : {}) };
    this.suites.set(suite.id, suite);
    return suite;
  }

  getSuite(id: string): TestSuite {
    const suite = this.suites.get(id);
    if (!suite) throw new Error(`Test suite "${id}" not found`);
    return suite;
  }

  listSuites(): readonly TestSuite[] {
    return [...this.suites.values()];
  }

  createPlan(input: { id: string; name: string; objective: string; target: string; suiteIds: readonly string[]; profileId: string; required?: readonly string[] }): TestPlan {
    const plan: TestPlan = { id: input.id, name: input.name, objective: input.objective, target: input.target, suiteIds: input.suiteIds, profileId: input.profileId, ...(input.required !== undefined ? { required: input.required } : {}), createdAt: new Date().toISOString() };
    this.plans.set(plan.id, plan);
    return plan;
  }

  listPlans(): readonly TestPlan[] {
    return [...this.plans.values()];
  }

  createProfile(profile: TestProfile): TestProfile {
    this.profiles.set(profile.id, profile);
    return profile;
  }

  listProfiles(): readonly TestProfile[] {
    return [...this.profiles.values()];
  }

  async run(suiteId: string, profileId: string, env: Record<string, unknown> = {}): Promise<TestRun> {
    const suite = this.getSuite(suiteId);
    const profile = this.profiles.get(profileId);
    if (!profile) throw new Error(`Test profile "${profileId}" not found`);
    const selected = suite.tests.filter((t) => profile.types.includes(t.type));
    const selectedSuite: TestSuite = { ...suite, tests: selected };

    const results: NormalizedTestCaseResult[] = [];
    const groups = new Map<string, TestDefinition[]>();
    for (const test of selected) {
      const list = groups.get(test.runnerId) ?? [];
      list.push(test);
      groups.set(test.runnerId, list);
    }
    for (const [runnerId, tests] of groups) {
      const runner = this.registry.get(runnerId);
      const groupSuite: TestSuite = { ...selectedSuite, tests };
      const plan = await runner.plan({ suite: groupSuite, profile, environment: String(env.API_BASE ?? '') });
      const execution = await runner.execute(plan);
      for (const r of execution.results) {
        const definition = tests.find((t) => t.id === r.testId);
        results.push({ testId: r.testId, status: r.status, durationMs: r.durationMs, attempt: r.attempt, ...(r.error !== undefined ? { error: r.error } : {}), artifactIds: [], logIds: [], ...(definition?.description !== undefined ? {} : {}) });
      }
    }
    this.historyRecords.push(...results);
    const run = buildTestRun({ planId: 'manual', profileId, target: suite.name, results });
    this.runs.set(run.id, run);
    return run;
  }

  listRuns(): readonly TestRun[] {
    return [...this.runs.values()].sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''));
  }

  flaky(testId: string): ReturnType<FlakinessAnalyzer['analyze']> {
    const entries = this.historyRecords.filter((h) => h.testId === testId).map((h, i) => ({ testId: h.testId, status: h.status, at: `t${i}` }));
    return this.flakiness.analyze(entries);
  }

  impact(input: Parameters<ImpactAnalyzer['analyze']>[0]): ReturnType<ImpactAnalyzer['analyze']> {
    return new ImpactAnalyzer().analyze(input);
  }
}
