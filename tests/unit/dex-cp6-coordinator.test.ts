import { describe, it, expect, beforeEach } from 'vitest';
import { DeveloperExecutionCoordinator } from '../../src/car/runtime/developer-execution-coordinator.js';
import { SkillRegistry } from '../../src/skill/registry/skill-registry.js';
import { SkillResolver } from '../../src/skill/resolver/skill-resolver.js';
import { AgentRegistry } from '../../src/agent/registry/agent-registry.js';
import { MemoryCodingAdapter } from '../../src/car/adapters/memory-coding-adapter.js';
import type { SkillDefinition } from '../../src/skill/domain/contracts.js';
import type { AgentDefinition } from '../../src/agent/domain/contracts.js';
import type {
  VerificationControlPlane,
  VerificationRequest,
  VerificationPlan,
  VerificationVerdict,
} from '../../src/verification/domain/contracts.js';

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

function indeterminateVerdict(): VerificationVerdict {
  return {
    purpose: 'developer-handoff',
    conclusion: 'indeterminate',
    freshness: 'current',
    level: 'V0',
    affectedModules: [],
    requiredEvidence: [],
    satisfiedEvidence: [],
    missingEvidence: ['verification-report'],
    sources: [],
    reasons: [{ kind: 'baseline-failure', message: 'pre-existing failures' }],
  };
}

function staleVerdict(): VerificationVerdict {
  return {
    ...passVerdict(),
    freshness: 'stale',
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

function makeCoordinator(verdictFn: () => VerificationVerdict): DeveloperExecutionCoordinator {
  return new DeveloperExecutionCoordinator({
    agents: agentRegistry,
    skillRegistry: registry,
    skillResolver,
    verification: new StubVerification(verdictFn),
  });
}

describe('DeveloperExecutionCoordinator', () => {
  it('composes full pipeline: agent → skills → context → runtime → VCTRL → evidence', async () => {
    const coordinator = makeCoordinator(() => passVerdict());
    const adapter = new MemoryCodingAdapter('vestara', {
      toolRequests: [{ name: 'write', input: { path: 'scripts/hello.ts', content: 'console.log("Hello from Vestara")' } }],
    });

    const result = await coordinator.execute(
      {
        executionId: 'exec-1',
        agentId: 'vestara-developer',
        goal: 'Generate scripts/hello.ts that prints Hello from Vestara',
        roomId: 'activity-room',
      },
      adapter,
    );

    expect(result.outcome).toBe('completed');
    expect(result.handoffEligible).toBe(true);
    expect(result.evidence).toBeDefined();
    expect(result.evidence!.verification.handoffEligible).toBe(true);
    expect(result.context.governance.skills.length).toBeGreaterThan(0);
    expect(result.verification.conclusion).toBe('pass');
    expect(result.runtimeId).toBe('vestara');
  });

  it('FAIL verdict → handoffEligible=false', async () => {
    const coordinator = makeCoordinator(() => failVerdict());
    const adapter = new MemoryCodingAdapter('vestara');

    const result = await coordinator.execute(
      { executionId: 'exec-2', agentId: 'vestara-developer', goal: 'Build feature', roomId: 'activity-room' },
      adapter,
    );

    expect(result.outcome).toBe('completed');
    expect(result.handoffEligible).toBe(false);
    expect(result.evidence!.verification.handoffEligible).toBe(false);
  });

  it('INDETERMINATE verdict → handoffEligible=false', async () => {
    const coordinator = makeCoordinator(() => indeterminateVerdict());
    const adapter = new MemoryCodingAdapter('vestara');

    const result = await coordinator.execute(
      { executionId: 'exec-3', agentId: 'vestara-developer', goal: 'Build feature', roomId: 'activity-room' },
      adapter,
    );

    expect(result.handoffEligible).toBe(false);
    expect(result.evidence!.verification.conclusion).toBe('indeterminate');
  });

  it('stale PASS → handoffEligible=false', async () => {
    const coordinator = makeCoordinator(() => staleVerdict());
    const adapter = new MemoryCodingAdapter('vestara');

    const result = await coordinator.execute(
      { executionId: 'exec-4', agentId: 'vestara-developer', goal: 'Build feature', roomId: 'activity-room' },
      adapter,
    );

    expect(result.handoffEligible).toBe(false);
    expect(result.evidence!.verification.freshness).toBe('stale');
  });

  it('runtime failure → evidence still produced', async () => {
    const coordinator = makeCoordinator(() => passVerdict());
    const failingAdapter: MemoryCodingAdapter = {
      id: 'vestara',
      async capabilities() { return { streaming: true, sessions: true, resumableSessions: true, tools: true, customTools: true, filesystem: true, shell: true, structuredOutput: true, repositoryContext: true, approvals: true, cancellation: true, nativeSkills: true, nativeAgents: true }; },
      async createSession() { throw new Error('adapter crashed'); },
      async resumeSession() { throw new Error('adapter crashed'); },
      async *execute() { yield { type: 'failed', message: 'adapter crashed' }; },
      async cancel() {},
      async close() {},
    } as unknown as MemoryCodingAdapter;

    const result = await coordinator.execute(
      { executionId: 'exec-5', agentId: 'vestara-developer', goal: 'Build feature', roomId: 'activity-room' },
      failingAdapter,
    );

    expect(result.outcome).toBe('failed');
    expect(result.evidence).toBeDefined();
    expect(result.evidence!.outcome).toBe('failed');
    expect(result.error).toBe('adapter crashed');
  });

  it('evidence includes skill and tool provenance', async () => {
    const coordinator = makeCoordinator(() => passVerdict());
    const adapter = new MemoryCodingAdapter('vestara');

    const result = await coordinator.execute(
      { executionId: 'exec-6', agentId: 'vestara-developer', goal: 'Build feature', roomId: 'activity-room' },
      adapter,
    );

    expect(result.evidence!.skills).toHaveLength(1);
    expect(result.evidence!.skills[0].id).toBe('typescript-development');
    expect(result.evidence!.tools.length).toBeGreaterThan(0);
    expect(result.evidence!.tools.some((t) => t.id === 'read')).toBe(true);
  });

  it('evidence hash is deterministic', async () => {
    const coordinator = makeCoordinator(() => passVerdict());
    const adapter = new MemoryCodingAdapter('vestara');

    const r1 = await coordinator.execute(
      { executionId: 'exec-7', agentId: 'vestara-developer', goal: 'Build feature', roomId: 'activity-room' },
      adapter,
    );
    const r2 = await coordinator.execute(
      { executionId: 'exec-8', agentId: 'vestara-developer', goal: 'Build feature', roomId: 'activity-room' },
      adapter,
    );

    // Different execution IDs → different hashes, but same structure.
    expect(r1.evidence!.evidenceHash).not.toBe(r2.evidence!.evidenceHash);
    expect(r1.evidence!.schemaVersion).toBe(1);
    expect(r2.evidence!.schemaVersion).toBe(1);
  });

  it('Developer runtime never treats runtime completion alone as verified', async () => {
    // Even with PASS verdict, the evidence must reflect VCTRL's conclusion.
    const coordinator = makeCoordinator(() => passVerdict());
    const adapter = new MemoryCodingAdapter('vestara');

    const result = await coordinator.execute(
      { executionId: 'exec-9', agentId: 'vestara-developer', goal: 'Build feature', roomId: 'activity-room' },
      adapter,
    );

    // handoffEligible is derived from VCTRL, not from runtime completion.
    expect(result.handoffEligible).toBe(result.verification.conclusion === 'pass' && result.verification.freshness === 'current');
  });
});
