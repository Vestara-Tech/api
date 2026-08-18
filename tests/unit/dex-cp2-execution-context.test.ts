import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '../../src/skill/registry/skill-registry.js';
import { SkillResolver } from '../../src/skill/resolver/skill-resolver.js';
import { ExecutionContextAssembler } from '../../src/agent/context/execution-context-assembler.js';
import { serializeForOpenCode } from '../../src/agent/context/opencode-context-serializer.js';
import type { SkillDefinition } from '../../src/skill/domain/contracts.js';
import type { AgentDefinition, AgentRun } from '../../src/agent/domain/contracts.js';
import type { ExecutionContextInput } from '../../src/agent/context/execution-context-assembler.js';

const capabilityMap = new Map<string, ReadonlySet<string>>();

function setCapabilities(agentId: string, caps: string[]): void {
  capabilityMap.set(agentId, new Set(caps));
}

const typescriptSkill: SkillDefinition = {
  id: 'typescript-development',
  version: '1.0.0',
  name: 'TypeScript Development',
  description: 'Write idiomatic TypeScript.',
  instructions: 'Follow repo conventions.',
  requiredCapabilities: ['repo.read'],
  compatibleRoles: ['developer'],
  resources: [{ path: 'guide.md', kind: 'markdown', content: '# Guide' }],
};

const testAgent: AgentDefinition = {
  id: 'dev-1',
  version: '1.0.0',
  name: 'Developer',
  role: 'developer',
  model: { mode: 'auto' },
  instructions: { system: 'You are a developer.', guardrails: ['No secrets'] },
  tools: [{ id: 'read' }, { id: 'write' }],
  skills: [{ id: 'typescript-development' }],
  permissions: ['repo.read', 'repo.write'],
  execution: { maxSteps: 10, maxToolCalls: 50, allowDelegation: false, maxConcurrentChildren: 0, maxDepth: 0 },
};

const testRun: AgentRun = {
  id: 'run-1',
  agentId: 'dev-1',
  status: 'running',
  startedAt: '2026-01-01T00:00:00Z',
  currentStep: 1,
  totalSteps: 5,
};

let registry: SkillRegistry;
let skillResolver: SkillResolver;
let assembler: ExecutionContextAssembler;

beforeEach(() => {
  capabilityMap.clear();
  registry = new SkillRegistry();
  skillResolver = new SkillResolver({
    capabilities: (agentId) => capabilityMap.get(agentId) ?? new Set(),
  });
  assembler = new ExecutionContextAssembler({ skillRegistry: registry, skillResolver });
  registry.register(typescriptSkill);
  setCapabilities('dev-1', ['repo.read']);
});

describe('ExecutionContextAssembler', () => {
  describe('assemble', () => {
    it('builds identity context from agent definition', async () => {
      const ctx = await assembler.assemble({ agent: testAgent, run: testRun });
      expect(ctx.identity.agentId).toBe('dev-1');
      expect(ctx.identity.agentName).toBe('Developer');
      expect(ctx.identity.role).toBe('developer');
      expect(ctx.identity.runId).toBe('run-1');
    });

    it('builds objective context from input', async () => {
      const ctx = await assembler.assemble({
        agent: testAgent,
        run: testRun,
        goal: 'Build a feature',
        task: 'Implement the API',
        acceptanceCriteria: ['Tests pass', 'Typecheck clean'],
        constraints: ['No breaking changes'],
      });
      expect(ctx.objective.goal).toBe('Build a feature');
      expect(ctx.objective.task).toBe('Implement the API');
      expect(ctx.objective.acceptanceCriteria).toEqual(['Tests pass', 'Typecheck clean']);
      expect(ctx.objective.constraints).toEqual(['No breaking changes']);
    });

    it('resolves skills through CP1 resolver', async () => {
      const ctx = await assembler.assemble({ agent: testAgent, run: testRun });
      expect(ctx.governance.skills).toHaveLength(1);
      expect(ctx.governance.skills[0].id).toBe('typescript-development');
      expect(ctx.governance.skills[0].instructions).toBe('Follow repo conventions.');
      expect(ctx.governance.skills[0].resources).toHaveLength(1);
    });

    it('includes guardrails in governance', async () => {
      const ctx = await assembler.assemble({ agent: testAgent, run: testRun });
      expect(ctx.governance.guardrails).toEqual(['No secrets']);
    });

    it('includes tools and permissions in governance', async () => {
      const ctx = await assembler.assemble({
        agent: testAgent,
        run: testRun,
        toolDescriptions: ['read', 'write'],
      });
      expect(ctx.governance.toolDescriptions).toEqual(['read', 'write']);
      expect(ctx.governance.permissions).toEqual(['repo.read', 'repo.write']);
    });

    it('composes system instructions with skill instructions', async () => {
      const ctx = await assembler.assemble({ agent: testAgent, run: testRun });
      expect(ctx.governance.systemInstructions).toContain('You are a developer.');
      expect(ctx.governance.systemInstructions).toContain('Follow repo conventions.');
    });

    it('includes repository context when provided', async () => {
      const ctx = await assembler.assemble({
        agent: testAgent,
        run: testRun,
        repository: {
          root: '/workspace',
          branch: 'main',
          headSha: 'abc123',
          workingTreeState: 'clean',
          changedFiles: ['src/foo.ts'],
        },
      });
      expect(ctx.repository).toBeDefined();
      expect(ctx.repository!.root).toBe('/workspace');
      expect(ctx.repository!.branch).toBe('main');
      expect(ctx.repository!.headSha).toBe('abc123');
    });

    it('includes continuity context when provided', async () => {
      const ctx = await assembler.assemble({
        agent: testAgent,
        run: testRun,
        continuity: {
          workflowId: 'wf-1',
          currentMilestone: 'M1',
          currentTask: 'T1',
          completedPredecessors: ['plan-done'],
          plannerOutput: 'Plan: do this',
        },
      });
      expect(ctx.continuity).toBeDefined();
      expect(ctx.continuity!.workflowId).toBe('wf-1');
      expect(ctx.continuity!.completedPredecessors).toEqual(['plan-done']);
    });

    it('omits repository/continuity/conversation when not provided', async () => {
      const ctx = await assembler.assemble({ agent: testAgent, run: testRun });
      expect(ctx.repository).toBeUndefined();
      expect(ctx.continuity).toBeUndefined();
      expect(ctx.conversation).toBeUndefined();
    });

    it('selection metadata is populated', async () => {
      const ctx = await assembler.assemble({ agent: testAgent, run: testRun });
      expect(ctx.selection.totalItems).toBeGreaterThan(0);
      expect(ctx.selection.selectedItems).toBeGreaterThan(0);
      expect(ctx.selection.budgetTokens).toBe(128_000);
      expect(ctx.selection.resolvedAt).toBeTruthy();
    });

    it('no @opencode-ai/sdk types in canonical context', async () => {
      const ctx = await assembler.assemble({
        agent: testAgent,
        run: testRun,
        goal: 'test',
        repository: { root: '/workspace' },
        continuity: { workflowId: 'wf-1' },
        conversation: { sessionId: 'sess-1' },
      });
      // Verify the context is a plain object with no runtime-specific types.
      const serialized = JSON.stringify(ctx);
      expect(serialized).not.toContain('opencode');
      expect(serialized).not.toContain('Opencode');
    });
  });

  describe('determinism', () => {
    it('same inputs produce same context', async () => {
      const input: ExecutionContextInput = {
        agent: testAgent,
        run: testRun,
        goal: 'Build feature',
        toolDescriptions: ['read', 'write'],
        repository: { root: '/ws', branch: 'main' },
      };
      const ctx1 = await assembler.assemble(input);
      const ctx2 = await assembler.assemble(input);
      expect(ctx1.identity).toEqual(ctx2.identity);
      expect(ctx1.governance.systemInstructions).toBe(ctx2.governance.systemInstructions);
      expect(ctx1.selection.selectedItems).toBe(ctx2.selection.selectedItems);
    });
  });
});

describe('serializeForOpenCode', () => {
  it('produces a system prompt from canonical context', async () => {
    const ctx = await assembler.assemble({
      agent: testAgent,
      run: testRun,
      goal: 'Build feature',
    });
    const serialized = serializeForOpenCode(ctx);
    expect(serialized.systemPrompt).toContain('Developer');
    expect(serialized.systemPrompt).toContain('Build feature');
    expect(serialized.systemPrompt).toContain('You are a developer.');
    expect(serialized.sections.length).toBeGreaterThan(0);
  });

  it('sections are ordered by priority descending', async () => {
    const ctx = await assembler.assemble({
      agent: testAgent,
      run: testRun,
      goal: 'Build feature',
    });
    const serialized = serializeForOpenCode(ctx);
    for (let i = 1; i < serialized.sections.length; i++) {
      expect(serialized.sections[i - 1].priority).toBeGreaterThanOrEqual(serialized.sections[i].priority);
    }
  });

  it('serializes repository context when present', async () => {
    const ctx = await assembler.assemble({
      agent: testAgent,
      run: testRun,
      repository: { root: '/ws', branch: 'main' },
    });
    const serialized = serializeForOpenCode(ctx);
    expect(serialized.systemPrompt).toContain('/ws');
    expect(serialized.systemPrompt).toContain('main');
  });

  it('serializes continuity context when present', async () => {
    const ctx = await assembler.assemble({
      agent: testAgent,
      run: testRun,
      continuity: { workflowId: 'wf-1', plannerOutput: 'Plan: do X' },
    });
    const serialized = serializeForOpenCode(ctx);
    expect(serialized.systemPrompt).toContain('wf-1');
    expect(serialized.systemPrompt).toContain('Plan: do X');
  });
});
