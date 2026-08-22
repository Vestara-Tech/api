import { describe, expect, it, beforeEach } from 'vitest';
import { AgentStepExecutor } from '../../src/workflow/runtime/agent-step-executor.js';
import { DeveloperExecutionCoordinator } from '../../src/car/runtime/developer-execution-coordinator.js';
import { InMemoryRuntimeSessionRegistry } from '../../src/car/runtime/runtime-session-registry.js';
import { CodingAgentRuntimeRegistry } from '../../src/car/registry/coding-agent-runtime-registry.js';
import { RuntimeSelector } from '../../src/car/runtime/runtime-selector.js';
import { SkillRegistry } from '../../src/skill/registry/skill-registry.js';
import { SkillResolver } from '../../src/skill/resolver/skill-resolver.js';
import { AgentRegistry } from '../../src/agent/registry/agent-registry.js';
import type { SkillDefinition } from '../../src/skill/domain/contracts.js';
import type { AgentDefinition, AgentRuntimePolicy } from '../../src/agent/domain/contracts.js';
import type {
  CodingAgentCapabilities,
  CodingAgentEvent,
  CodingAgentRequest,
  CodingAgentRuntime,
  CodingAgentSession,
  CodingAgentSessionContext,
} from '../../src/car/domain/contracts.js';
import type {
  VerificationControlPlane,
  VerificationRequest,
  VerificationVerdict,
} from '../../src/verification/domain/contracts.js';
import type { AgentRuntime, AgentRun, AgentRunInput } from '../../src/agent/runtime/agent-runtime.js';

/**
 * ARX-014 — AgentStepExecutor integration tests.
 *
 * Three invariants under test:
 *   1. Coding agents (vestara-developer with runtimePolicy) → CAR → DeveloperExecutionCoordinator
 *   2. Non-coding agents (planner, reviewer, verifier) → standard AgentRuntime
 *   3. Workflow session cardinality: one workflow = one session = N reuses
 *   4. Capacity failure returns outcome 'queued' (governed state), not an exception
 */

const capabilityMap = new Map<string, ReadonlySet<string>>();
function setCapabilities(agentId: string, caps: string[]): void {
  capabilityMap.set(agentId, new Set(caps));
}

const tsSkill: SkillDefinition = {
  id: 'typescript-development',
  version: '1.0.0',
  name: 'TypeScript Development',
  description: 'Write TypeScript.',
  instructions: 'Follow conventions.',
  requiredCapabilities: ['repo.read'],
  compatibleRoles: ['developer'],
};

const devAgent: AgentDefinition = {
  id: 'vestara-developer',
  version: '1.0.0',
  name: 'Developer',
  role: 'developer',
  model: { mode: 'auto' },
  instructions: { system: 'You are a developer.' },
  tools: [{ id: 'read' }, { id: 'write' }],
  skills: [{ id: 'typescript-development' }],
  permissions: ['repo.read', 'repo.write'],
  execution: { maxSteps: 10, maxToolCalls: 50, allowDelegation: false, maxConcurrentChildren: 0, maxDepth: 0 },
  runtimePolicy: {
    runtime: 'auto',
    requirements: { repositoryEditing: true, terminal: false },
  },
};

const plannerAgent: AgentDefinition = {
  id: 'vestara-planner',
  version: '1.0.0',
  name: 'Planner',
  role: 'planner',
  model: { mode: 'auto' },
  instructions: { system: 'You are a planner.' },
  tools: [],
  skills: [],
  permissions: [],
  execution: { maxSteps: 5, maxToolCalls: 10, allowDelegation: false, maxConcurrentChildren: 0, maxDepth: 0 },
};

const reviewerAgent: AgentDefinition = {
  id: 'vestara-reviewer',
  version: '1.0.0',
  name: 'Reviewer',
  role: 'reviewer',
  model: { mode: 'auto' },
  instructions: { system: 'You are a reviewer.' },
  tools: [],
  skills: [],
  permissions: [],
  execution: { maxSteps: 3, maxToolCalls: 5, allowDelegation: false, maxConcurrentChildren: 0, maxDepth: 0 },
};

function passVerdict(): VerificationVerdict {
  return {
    purpose: 'developer-handoff',
    conclusion: 'pass',
    freshness: 'current',
    level: 'V1',
    fingerprint: 'sha256:abc123',
    affectedModules: ['car'],
    requiredEvidence: ['fingerprint'],
    satisfiedEvidence: ['fingerprint'],
    missingEvidence: [],
    sources: [{ sourceId: 'fastverify', level: 'V1', result: 'pass', fingerprint: 'sha256:abc123' }],
    reasons: [],
  };
}

function failVerdict(): VerificationVerdict {
  return {
    purpose: 'developer-handoff',
    conclusion: 'fail',
    freshness: 'current',
    level: 'V1',
    fingerprint: 'sha256:abc123',
    affectedModules: ['car'],
    requiredEvidence: ['fingerprint'],
    satisfiedEvidence: [],
    missingEvidence: ['fingerprint'],
    sources: [{ sourceId: 'fastverify', level: 'V1', result: 'fail' }],
    reasons: [{ kind: 'change-failure', message: 'tests failed' }],
  };
}

class StubVerification implements VerificationControlPlane {
  private readonly verdictFn: () => VerificationVerdict;
  constructor(verdictFn: () => VerificationVerdict) {
    this.verdictFn = verdictFn;
  }
  async analyze(request: VerificationRequest) {
    return { request, sources: [{ sourceId: 'fastverify', level: 'V1', reason: 'stub' }], level: 'V1', reason: 'stub' };
  }
  async execute(): Promise<VerificationVerdict> { return this.verdictFn(); }
  async verify(): Promise<VerificationVerdict> { return this.verdictFn(); }
}

/** Counting adapter: tracks create/resume/close calls. */
class CountingAdapter implements CodingAgentRuntime {
  readonly id = 'opencode' as const;
  createCount = 0;
  resumeCount = 0;
  closeCount = 0;
  readonly createdSessionIds: string[] = [];
  private fileEvents: readonly string[];

  constructor(options: { readonly fileEvents?: readonly string[] } = {}) {
    this.fileEvents = options.fileEvents ?? [];
  }

  async capabilities(): Promise<CodingAgentCapabilities> {
    return {
      streaming: true, sessions: true, resumableSessions: true, tools: true,
      customTools: true, filesystem: true, shell: false, structuredOutput: true,
      repositoryContext: true, approvals: true, cancellation: true,
      nativeSkills: true, nativeAgents: true,
    };
  }

  async createSession(context: CodingAgentSessionContext): Promise<CodingAgentSession> {
    this.createCount += 1;
    const id = `${this.id}:${context.runId}:${this.createCount}`;
    this.createdSessionIds.push(id);
    return { id, runtimeId: this.id, providerSessionId: context.runId, createdAt: new Date().toISOString(), resumed: false, model: 'opencode/nemotron-3-ultra-free' };
  }

  async resumeSession(sessionId: string): Promise<CodingAgentSession> {
    this.resumeCount += 1;
    return { id: sessionId, runtimeId: this.id, providerSessionId: sessionId, createdAt: new Date().toISOString(), resumed: true, model: 'opencode/nemotron-3-ultra-free' };
  }

  async *execute(_session: CodingAgentSession, request: CodingAgentRequest): AsyncIterable<CodingAgentEvent> {
    for (const file of this.fileEvents) {
      yield { type: 'tool-requested', name: 'write', input: { path: file } };
      yield { type: 'tool-started', name: 'write' };
      yield { type: 'tool-completed', name: 'write', output: { ok: true } };
      yield { type: 'file-changed', path: file };
    }
    yield { type: 'message', text: `[${this.id}] ${request.prompt}` };
    yield { type: 'completed' };
  }

  async cancel(): Promise<void> {}
  async close(): Promise<void> { this.closeCount += 1; }
}

/** Stub AgentRuntime: returns a pre-baked AgentRun without AI. */
class StubAgentRuntime implements AgentRuntime {
  private callCount = 0;

  get state() {
    return { create: () => ({ id: 'stub-run', status: 'pending' as const, agentId: '', createdAt: '' }), transition: () => ({}), get: () => ({ id: 'stub-run', status: 'completed' as const, agentId: '', createdAt: '' }) };
  }

  start(input: AgentRunInput): AgentRun {
    this.callCount += 1;
    return { id: `stub:${input.agentId}:${this.callCount}`, agentId: input.agentId, status: 'completed' as const, createdAt: new Date().toISOString() };
  }

  resume(): AgentRun { return { id: 'stub-resume', agentId: '', status: 'completed' as const, createdAt: '' }; }
  cancel(): void {}
  events() { return []; }
}

let agentRegistry: AgentRegistry;
let skillRegistry: SkillRegistry;
let skillResolver: SkillResolver;
let adapter: CountingAdapter;
let codingRegistry: CodingAgentRuntimeRegistry;
let selector: RuntimeSelector;
let stubRuntime: StubAgentRuntime;

beforeEach(() => {
  capabilityMap.clear();
  agentRegistry = new AgentRegistry();
  agentRegistry.register(devAgent);
  agentRegistry.register(plannerAgent);
  agentRegistry.register(reviewerAgent);

  skillRegistry = new SkillRegistry();
  skillRegistry.register(tsSkill);

  skillResolver = new SkillResolver({
    capabilities: (agentId) => capabilityMap.get(agentId) ?? new Set(),
  });
  setCapabilities('vestara-developer', ['repo.read']);

  adapter = new CountingAdapter();
  codingRegistry = new CodingAgentRuntimeRegistry();
  codingRegistry.register(adapter);
  selector = new RuntimeSelector(codingRegistry);
  stubRuntime = new StubAgentRuntime();
});

function makeCoordinator(
  verdictFn: () => VerificationVerdict,
  sessions?: InMemoryRuntimeSessionRegistry,
): DeveloperExecutionCoordinator {
  return new DeveloperExecutionCoordinator({
    agents: agentRegistry,
    skillRegistry,
    skillResolver,
    verification: new StubVerification(verdictFn),
    sessions: sessions ?? new InMemoryRuntimeSessionRegistry({ maxActiveSessions: 2, maxSessionsPerExecution: 1, sessionIdleTimeoutMs: 60_000, maxFixAttempts: 1 }),
  });
}

function makeExecutor(
  verdictFn: () => VerificationVerdict,
  sessions?: InMemoryRuntimeSessionRegistry,
): AgentStepExecutor {
  return new AgentStepExecutor({
    agents: agentRegistry,
    agentRuntime: stubRuntime,
    selector,
    registry: codingRegistry,
    coordinator: makeCoordinator(verdictFn, sessions),
  });
}

// ══════════════════════════════════════════════════════════════════
// 1. Dispatch boundary: coding agent → CAR, non-coding → AgentRuntime
// ══════════════════════════════════════════════════════════════════

describe('ARX-014 AgentStepExecutor — dispatch boundary', () => {
  it('routes vestara-developer through CAR (DeveloperExecutionCoordinator)', async () => {
    const executor = makeExecutor(passVerdict);
    const result = await executor.execute({
      agentId: 'vestara-developer',
      goal: 'Build the Theme Builder',
      workflowRunId: 'wf:001',
      agentAssignmentId: 'developer-primary',
      executionId: 'exec:001',
    });

    expect(result.outcome).toBe('completed');
    expect(result.sessionId).toBeDefined();
    expect(adapter.createCount).toBe(1);
  });

  it('routes vestara-planner through standard AgentRuntime (no CAR)', async () => {
    const executor = makeExecutor(passVerdict);
    const result = await executor.execute({
      agentId: 'vestara-planner',
      goal: 'Plan the Theme Builder',
      workflowRunId: 'wf:001',
      agentAssignmentId: 'planner-primary',
      executionId: 'exec:001',
    });

    expect(result.outcome).toBe('completed');
    expect(result.sessionId).toBeUndefined();
    expect(adapter.createCount).toBe(0);
    expect(result.agentRunId).toContain('stub:');
  });

  it('routes vestara-reviewer through standard AgentRuntime (no CAR)', async () => {
    const executor = makeExecutor(passVerdict);
    const result = await executor.execute({
      agentId: 'vestara-reviewer',
      goal: 'Review Theme Builder',
      workflowRunId: 'wf:001',
      agentAssignmentId: 'reviewer-primary',
      executionId: 'exec:001',
    });

    expect(result.outcome).toBe('completed');
    expect(result.sessionId).toBeUndefined();
    expect(adapter.createCount).toBe(0);
  });

  it('returns failed outcome when CAR adapter is not registered', async () => {
    const emptyRegistry = new CodingAgentRuntimeRegistry();
    const emptySelector = new RuntimeSelector(emptyRegistry);
    const executor = new AgentStepExecutor({
      agents: agentRegistry,
      agentRuntime: stubRuntime,
      selector: emptySelector,
      registry: emptyRegistry,
      coordinator: makeCoordinator(passVerdict),
    });

    const result = await executor.execute({
      agentId: 'vestara-developer',
      goal: 'Build something',
      workflowRunId: 'wf:001',
      executionId: 'exec:001',
    });

    expect(result.outcome).toBe('failed');
    expect(result.error).toContain('not found');
  });
});

// ══════════════════════════════════════════════════════════════════
// 2. Workflow session cardinality: 1 workflow = 1 session, N reuses
// ══════════════════════════════════════════════════════════════════

describe('ARX-014 — workflow session cardinality', () => {
  it('creates exactly one session for a workflow with N developer steps', async () => {
    const sessions = new InMemoryRuntimeSessionRegistry({
      maxActiveSessions: 2,
      maxSessionsPerExecution: 1,
      sessionIdleTimeoutMs: 60_000,
      maxFixAttempts: 1,
    });
    const executor = makeExecutor(passVerdict, sessions);

    // Simulate a workflow with 3 developer steps on the same workflowRunId.
    const workflowRunId = 'wf:theme-builder';
    const agentAssignmentId = 'developer-primary';
    const executionId = 'exec:theme-builder';

    const r1 = await executor.execute({
      agentId: 'vestara-developer',
      goal: 'Implement theme store',
      workflowRunId,
      agentAssignmentId,
      executionId,
    });
    const r2 = await executor.execute({
      agentId: 'vestara-developer',
      goal: 'Implement theme preview',
      workflowRunId,
      agentAssignmentId,
      executionId,
    });
    const r3 = await executor.execute({
      agentId: 'vestara-developer',
      goal: 'Implement theme export',
      workflowRunId,
      agentAssignmentId,
      executionId,
    });

    // Exactly one session was created; steps 2 and 3 reused it.
    expect(adapter.createCount).toBe(1);
    expect(adapter.resumeCount).toBe(2);
    expect(r1.sessionId).toBeDefined();
    expect(r2.sessionId).toBe(r1.sessionId);
    expect(r3.sessionId).toBe(r1.sessionId);
  });

  it('separates sessions for different workflowRunIds', async () => {
    const sessions = new InMemoryRuntimeSessionRegistry({
      maxActiveSessions: 4,
      maxSessionsPerExecution: 1,
      sessionIdleTimeoutMs: 60_000,
      maxFixAttempts: 1,
    });
    const executor = makeExecutor(passVerdict, sessions);

    const r1 = await executor.execute({
      agentId: 'vestara-developer',
      goal: 'Build Theme Builder',
      workflowRunId: 'wf:theme-builder',
      agentAssignmentId: 'developer-primary',
      executionId: 'exec:theme-builder',
    });

    const r2 = await executor.execute({
      agentId: 'vestara-developer',
      goal: 'Build Admin Panel',
      workflowRunId: 'wf:admin-panel',
      agentAssignmentId: 'developer-primary',
      executionId: 'exec:admin-panel',
    });

    // Two different workflows → two different sessions.
    expect(adapter.createCount).toBe(2);
    expect(r1.sessionId).not.toBe(r2.sessionId);
  });

  it('separates sessions for different agentAssignmentIds in the same workflow', async () => {
    const sessions = new InMemoryRuntimeSessionRegistry({
      maxActiveSessions: 4,
      maxSessionsPerExecution: 1,
      maxActiveSessionsPerWorkflow: 2,
      sessionIdleTimeoutMs: 60_000,
      maxFixAttempts: 1,
    });
    const executor = makeExecutor(passVerdict, sessions);

    const r1 = await executor.execute({
      agentId: 'vestara-developer',
      goal: 'Build feature A',
      workflowRunId: 'wf:complex-app',
      agentAssignmentId: 'developer-frontend',
      executionId: 'exec:complex-app',
    });

    const r2 = await executor.execute({
      agentId: 'vestara-developer',
      goal: 'Build feature B',
      workflowRunId: 'wf:complex-app',
      agentAssignmentId: 'developer-backend',
      executionId: 'exec:complex-app',
    });

    // Same workflow, different assignments → two sessions.
    expect(adapter.createCount).toBe(2);
    expect(r1.sessionId).not.toBe(r2.sessionId);
  });
});

// ══════════════════════════════════════════════════════════════════
// 3. Capacity failure as governed state (not exception)
// ══════════════════════════════════════════════════════════════════

describe('ARX-014 — capacity failure as governed state', () => {
  it('returns queued when capacity is exhausted', async () => {
    const sessions = new InMemoryRuntimeSessionRegistry({
      maxActiveSessions: 1,
      maxSessionsPerExecution: 1,
      sessionIdleTimeoutMs: 60_000,
      maxFixAttempts: 1,
    });
    const executor = makeExecutor(passVerdict, sessions);

    // First workflow consumes the only active slot.
    const r1 = await executor.execute({
      agentId: 'vestara-developer',
      goal: 'Build first app',
      workflowRunId: 'wf:first',
      agentAssignmentId: 'developer-primary',
      executionId: 'exec:first',
    });
    expect(r1.outcome).toBe('completed');
    expect(adapter.createCount).toBe(1);

    // Second workflow hits capacity — should get queued, not throw.
    const r2 = await executor.execute({
      agentId: 'vestara-developer',
      goal: 'Build second app',
      workflowRunId: 'wf:second',
      agentAssignmentId: 'developer-primary',
      executionId: 'exec:second',
    });

    expect(r2.outcome).toBe('queued');
    // Still only one session was created.
    expect(adapter.createCount).toBe(1);
  });

  it('does not exceed maxSessionsPerWorkflow', async () => {
    const sessions = new InMemoryRuntimeSessionRegistry({
      maxActiveSessions: 10,
      maxSessionsPerExecution: 1,
      maxActiveSessionsPerWorkflow: 2,
      sessionIdleTimeoutMs: 60_000,
      maxFixAttempts: 1,
    });
    const executor = makeExecutor(passVerdict, sessions);

    // Two different agentAssignmentIds on the same workflow should each get one session.
    const r1 = await executor.execute({
      agentId: 'vestara-developer',
      goal: 'Feature A',
      workflowRunId: 'wf:app',
      agentAssignmentId: 'dev-frontend',
      executionId: 'exec:app',
    });
    const r2 = await executor.execute({
      agentId: 'vestara-developer',
      goal: 'Feature B',
      workflowRunId: 'wf:app',
      agentAssignmentId: 'dev-backend',
      executionId: 'exec:app',
    });

    expect(r1.outcome).toBe('completed');
    expect(r2.outcome).toBe('completed');
    expect(adapter.createCount).toBe(2);
  });
});

// ══════════════════════════════════════════════════════════════════
// 4. Session lifecycle events on coding agent steps
// ══════════════════════════════════════════════════════════════════

describe('ARX-014 — session lifecycle events', () => {
  it('first coding step creates session and emits session-created', async () => {
    const executor = makeExecutor(passVerdict);
    const result = await executor.execute({
      agentId: 'vestara-developer',
      goal: 'Build Theme Builder',
      workflowRunId: 'wf:001',
      agentAssignmentId: 'developer-primary',
      executionId: 'exec:001',
    });

    expect(result.outcome).toBe('completed');
    expect(result.events.some((e) => e.type === 'session-created')).toBe(true);
    expect(result.events.some((e) => e.type === 'runtime-session-requested')).toBe(true);
  });

  it('subsequent coding steps reuse session and emit runtime-session-reused', async () => {
    const sessions = new InMemoryRuntimeSessionRegistry({
      maxActiveSessions: 2,
      maxSessionsPerExecution: 1,
      sessionIdleTimeoutMs: 60_000,
      maxFixAttempts: 1,
    });
    const executor = makeExecutor(passVerdict, sessions);

    await executor.execute({
      agentId: 'vestara-developer',
      goal: 'Step 1',
      workflowRunId: 'wf:001',
      agentAssignmentId: 'developer-primary',
      executionId: 'exec:001',
    });

    const r2 = await executor.execute({
      agentId: 'vestara-developer',
      goal: 'Step 2',
      workflowRunId: 'wf:001',
      agentAssignmentId: 'developer-primary',
      executionId: 'exec:001',
    });

    expect(r2.events.some((e) => e.type === 'runtime-session-reused')).toBe(true);
    expect(r2.events.some((e) => e.type === 'session-resumed')).toBe(true);
  });

  it('non-coding agent steps emit no session lifecycle events', async () => {
    const executor = makeExecutor(passVerdict);
    const result = await executor.execute({
      agentId: 'vestara-planner',
      goal: 'Plan Theme Builder',
      workflowRunId: 'wf:001',
      agentAssignmentId: 'planner-primary',
      executionId: 'exec:001',
    });

    expect(result.events).toHaveLength(0);
    expect(result.sessionId).toBeUndefined();
  });
});

// ══════════════════════════════════════════════════════════════════
// 5. Verification failure triggers bounded fix with session reuse
// ══════════════════════════════════════════════════════════════════

describe('ARX-014 — verification fix with session reuse', () => {
  it('reuses same session across FAIL→fix→PASS', async () => {
    let callCount = 0;
    const verdicts = [failVerdict(), passVerdict()];

    class SequencedVerification implements VerificationControlPlane {
      async analyze(request: VerificationRequest) {
        return { request, sources: [{ sourceId: 'fastverify', level: 'V1', reason: 'stub' }], level: 'V1', reason: 'stub' };
      }
      async execute(): Promise<VerificationVerdict> { return verdicts[callCount] ?? passVerdict(); }
      async verify(): Promise<VerificationVerdict> { return this.execute(); }
    }

    const sessions = new InMemoryRuntimeSessionRegistry({
      maxActiveSessions: 2,
      maxSessionsPerExecution: 1,
      sessionIdleTimeoutMs: 60_000,
      maxFixAttempts: 2,
    });

    const adapterWithFiles = new CountingAdapter({ fileEvents: ['src/app.ts'] });
    codingRegistry = new CodingAgentRuntimeRegistry();
    codingRegistry.register(adapterWithFiles);
    selector = new RuntimeSelector(codingRegistry);

    const coordinator = new DeveloperExecutionCoordinator({
      agents: agentRegistry,
      skillRegistry,
      skillResolver,
      verification: new SequencedVerification(),
      sessions,
      maxFixAttempts: 2,
    });

    const executor = new AgentStepExecutor({
      agents: agentRegistry,
      agentRuntime: stubRuntime,
      selector,
      registry: codingRegistry,
      coordinator,
    });

    const result = await executor.execute({
      agentId: 'vestara-developer',
      goal: 'Build Theme Builder',
      workflowRunId: 'wf:001',
      agentAssignmentId: 'developer-primary',
      executionId: 'exec:001',
    });

    expect(result.outcome).toBe('completed');
    expect(adapterWithFiles.createCount).toBe(1);
    expect(adapterWithFiles.resumeCount).toBeGreaterThanOrEqual(1);
  });
});
