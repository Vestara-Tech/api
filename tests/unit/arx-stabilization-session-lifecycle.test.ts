import { describe, expect, it, beforeEach } from 'vitest';
import { DeveloperExecutionCoordinator } from '../../src/car/runtime/developer-execution-coordinator.js';
import { InMemoryRuntimeSessionRegistry, CapacityExhaustedError } from '../../src/car/runtime/runtime-session-registry.js';
import { SkillRegistry } from '../../src/skill/registry/skill-registry.js';
import { SkillResolver } from '../../src/skill/resolver/skill-resolver.js';
import { AgentRegistry } from '../../src/agent/registry/agent-registry.js';
import type { SkillDefinition } from '../../src/skill/domain/contracts.js';
import type { AgentDefinition } from '../../src/agent/domain/contracts.js';
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
  VerificationPlan,
  VerificationVerdict,
} from '../../src/verification/domain/contracts.js';

/**
 * ARX-STAB-003 DEX-CP3.1 — Runtime session lifecycle + resource guardrails.
 *
 * The invariant under test:
 *   One Developer execution owns one durable CAR runtime session. Subsequent
 *   steps, tool continuations, retries, verification fixes, and workflow
 *   continuation reuse that session unless an explicit session-boundary
 *   policy requires a new one.
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
  async analyze(request: VerificationRequest): Promise<VerificationPlan> {
    return { request, sources: [{ sourceId: 'fastverify', level: 'V1', reason: 'stub' }], level: 'V1', reason: 'stub' };
  }
  async execute(): Promise<VerificationVerdict> { return this.verdictFn(); }
  async verify(request: VerificationRequest): Promise<VerificationVerdict> { return this.verdictFn(); }
}

/** DEX-CP3.1 — Counting adapter: asserts exactly one createSession per execution. */
class CountingAdapter implements CodingAgentRuntime {
  readonly id = 'opencode' as const;
  createCount = 0;
  resumeCount = 0;
  closeCount = 0;
  readonly createdSessionIds: string[] = [];

  constructor(private readonly options: { readonly filesPerRun?: readonly string[] } = {}) {}

  async capabilities(): Promise<CodingAgentCapabilities> {
    return {
      streaming: true,
      sessions: true,
      resumableSessions: true,
      tools: true,
      customTools: true,
      filesystem: true,
      shell: true,
      structuredOutput: true,
      repositoryContext: true,
      approvals: true,
      cancellation: true,
      nativeSkills: true,
      nativeAgents: true,
    };
  }

  async createSession(context: CodingAgentSessionContext): Promise<CodingAgentSession> {
    this.createCount += 1;
    const id = `${this.id}:${context.runId}`;
    this.createdSessionIds.push(id);
    return { id, runtimeId: this.id, providerSessionId: context.runId, createdAt: new Date().toISOString(), resumed: false, model: 'opencode/nemotron-3-ultra-free' };
  }

  async resumeSession(sessionId: string): Promise<CodingAgentSession> {
    this.resumeCount += 1;
    return { id: sessionId, runtimeId: this.id, providerSessionId: sessionId, createdAt: new Date().toISOString(), resumed: true, model: 'opencode/nemotron-3-ultra-free' };
  }

  async *execute(_session: CodingAgentSession, request: CodingAgentRequest): AsyncIterable<CodingAgentEvent> {
    for (const file of this.options.filesPerRun ?? []) {
      yield { type: 'tool-requested', name: 'write', input: { path: file } };
      yield { type: 'tool-started', name: 'write' };
      yield { type: 'tool-completed', name: 'write', output: { ok: true } };
      yield { type: 'file-changed', path: file };
    }
    yield { type: 'message', text: `[${this.id}] ${request.prompt}` };
    yield { type: 'completed' };
  }

  async cancel(_sessionId: string): Promise<void> {}
  async close(_sessionId: string): Promise<void> {
    this.closeCount += 1;
  }
}

let registry: SkillRegistry;
let skillResolver: SkillResolver;
let agentRegistry: AgentRegistry;

beforeEach(() => {
  capabilityMap.clear();
  registry = new SkillRegistry();
  skillResolver = new SkillResolver({
    capabilities: (agentId) => capabilityMap.get(agentId) ?? new Set(),
  });
  agentRegistry = new AgentRegistry();
  agentRegistry.register(devAgent);
  registry.register(tsSkill);
  setCapabilities('vestara-developer', ['repo.read']);
});

function makeCoordinator(
  verdictFn: () => VerificationVerdict,
  sessions?: InMemoryRuntimeSessionRegistry,
): DeveloperExecutionCoordinator {
  return new DeveloperExecutionCoordinator({
    agents: agentRegistry,
    skillRegistry: registry,
    skillResolver,
    verification: new StubVerification(verdictFn),
    sessions: sessions ?? new InMemoryRuntimeSessionRegistry({ maxActiveSessions: 2, maxSessionsPerExecution: 1, sessionIdleTimeoutMs: 60_000, maxFixAttempts: 1 }),
  });
}

function executionRequest(executionId: string, goal: string): Parameters<DeveloperExecutionCoordinator['execute']>[0] {
  return {
    executionId,
    agentId: 'vestara-developer',
    goal,
    roomId: 'activity-room',
    repository: { root: process.cwd() },
  };
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('DEX-CP3.1 coordinator session lifecycle', () => {
  it('creates exactly ONE session across VCTRL-fail → retry → VCTRL-pass', async () => {
    const verdicts = [failVerdict(), passVerdict()];
    let call = 0;
    const coordinator = makeCoordinator(() => verdicts[Math.min(call++, verdicts.length - 1)]);
    const adapter = new CountingAdapter({ filesPerRun: ['scripts/arx-smoke.ts'] });

    const result = await coordinator.execute(executionRequest('exec-fix', 'Generate scripts/arx-smoke.ts'), adapter);

    expect(adapter.createCount).toBe(1);
    expect(adapter.resumeCount).toBe(1);
    expect(result.handoffEligible).toBe(true);
    expect(result.outcome).toBe('completed');
    expect(result.sessionId).toBe(adapter.createdSessionIds[0]);

    const types = result.events.map((e) => e.type);
    expect(types[0]).toBe('session-created');
    expect(types).toContain('session-resumed');
    expect(types.filter((t) => t === 'session-created')).toHaveLength(1);

    expect(result.evidence?.runtime.sessionId).toBe(adapter.createdSessionIds[0]);
    expect(result.evidence?.model).toEqual({ providerId: 'opencode', modelId: 'nemotron-3-ultra-free' });
  });

  it('isolation: distinct executions own distinct sessions', async () => {
    const sessions = new InMemoryRuntimeSessionRegistry({ maxActiveSessions: 4, maxSessionsPerExecution: 1, sessionIdleTimeoutMs: 60_000, maxFixAttempts: 1 });
    const coordinator = makeCoordinator(() => passVerdict(), sessions);
    const adapter = new CountingAdapter({ filesPerRun: ['scripts/a.ts'] });

    const a = await coordinator.execute(executionRequest('exec-a', 'Task A'), adapter);
    const b = await coordinator.execute(executionRequest('exec-b', 'Task B'), adapter);

    expect(adapter.createCount).toBe(2);
    expect(a.sessionId).toBe('opencode:exec-a');
    expect(b.sessionId).toBe('opencode:exec-b');
    expect(a.sessionId).not.toBe(b.sessionId);
    expect(sessions.activeCount()).toBe(0);
  });

  it('a single-pass execution records no session-resumed', async () => {
    const coordinator = makeCoordinator(() => passVerdict());
    const adapter = new CountingAdapter({ filesPerRun: ['scripts/a.ts'] });

    const result = await coordinator.execute(executionRequest('exec-pass', 'Task'), adapter);

    expect(adapter.createCount).toBe(1);
    expect(adapter.resumeCount).toBe(0);
    expect(result.events[0]?.type).toBe('session-created');
  });
});

describe('DEX-CP3.1 registry atomicity', () => {
  it('concurrent getOrCreate for the same execution yields ONE session', async () => {
    const sessions = new InMemoryRuntimeSessionRegistry({ maxActiveSessions: 2, maxSessionsPerExecution: 1, sessionIdleTimeoutMs: 60_000, maxFixAttempts: 1 });
    let creates = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const p1 = sessions.getOrCreate('exec-x', 'exec-x', {
      runtime: 'opencode',
      create: async () => {
        creates += 1;
        await gate;
        return { sessionId: 'opencode:x', providerSessionId: 'x' };
      },
    });
    const p2 = sessions.getOrCreate('exec-x', 'exec-x', {
      runtime: 'opencode',
      create: async () => {
        creates += 1;
        return { sessionId: 'opencode:y', providerSessionId: 'y' };
      },
    });

    release();
    const [first, second] = await Promise.all([p1, p2]);

    expect(creates).toBe(1);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.binding.sessionId).toBe('opencode:x');
    expect(second.binding.resumedCount).toBe(1);
  });

  it('capacity: a queued execution must not spawn while capacity is exhausted', async () => {
    const sessions = new InMemoryRuntimeSessionRegistry({ maxActiveSessions: 1, maxSessionsPerExecution: 1, sessionIdleTimeoutMs: 60_000, maxFixAttempts: 1 });

    await sessions.getOrCreate('exec-a', 'exec-a', {
      runtime: 'opencode',
      create: async () => ({ sessionId: 'opencode:a', providerSessionId: 'a' }),
    });

    // ARX-014 — Capacity exhaustion now throws immediately (governed state), not blocking wait.
    await expect(
      sessions.getOrCreate('exec-b', 'exec-b', {
        runtime: 'opencode',
        create: async () => ({ sessionId: 'opencode:b', providerSessionId: 'b' }),
      }),
    ).rejects.toThrow(CapacityExhaustedError);

    expect(sessions.activeCount()).toBe(1);

    // After freeing the slot, a new creation succeeds.
    sessions.complete('exec-a', 'exec-a');
    const acquiredB = await sessions.getOrCreate('exec-b', 'exec-b', {
      runtime: 'opencode',
      create: async () => ({ sessionId: 'opencode:b', providerSessionId: 'b' }),
    });
    expect(acquiredB.binding.sessionId).toBe('opencode:b');
    expect(acquiredB.created).toBe(true);
  });

  it('idle reaping finalizes and frees capacity without losing the binding', async () => {
    const sessions = new InMemoryRuntimeSessionRegistry({ maxActiveSessions: 1, maxSessionsPerExecution: 1, sessionIdleTimeoutMs: 1000, maxFixAttempts: 1 });
    const closed: string[] = [];

    const acquired = await sessions.getOrCreate(
      'exec-a',
      'exec-a',
      { runtime: 'opencode', create: async () => ({ sessionId: 'opencode:a', providerSessionId: 'a' }) },
      async (sessionId) => {
        closed.push(sessionId);
      },
    );
    acquired.binding.lastUsedAt = new Date(Date.now() - 5_000).toISOString();

    await sessions.sweepIdle();

    expect(closed).toEqual(['opencode:a']);
    expect(sessions.get('exec-a', 'exec-a')?.status).toBe('suspended');
    expect(sessions.activeCount()).toBe(0);

    const b = await sessions.getOrCreate('exec-b', 'exec-b', {
      runtime: 'opencode',
      create: async () => ({ sessionId: 'opencode:b', providerSessionId: 'b' }),
    });
    expect(b.binding.sessionId).toBe('opencode:b');
  });

  it('resume increments resumedCount without a second create', async () => {
    const sessions = new InMemoryRuntimeSessionRegistry({ maxActiveSessions: 2, maxSessionsPerExecution: 1, sessionIdleTimeoutMs: 60_000, maxFixAttempts: 1 });
    let creates = 0;

    const first = await sessions.getOrCreate('exec-x', 'run-1', {
      runtime: 'opencode',
      create: async () => {
        creates += 1;
        return { sessionId: 'opencode:x', providerSessionId: 'x' };
      },
    });
    const second = await sessions.getOrCreate('exec-x', 'run-1', {
      runtime: 'opencode',
      create: async () => {
        creates += 1;
        return { sessionId: 'opencode:other', providerSessionId: 'other' };
      },
    });

    expect(creates).toBe(1);
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.binding.sessionId).toBe('opencode:x');
    expect(second.binding.createdCount).toBe(1);
    expect(second.binding.resumedCount).toBe(1);
  });
});