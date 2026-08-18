import { describe, expect, it } from 'vitest';
import {
  AgentRegistry,
  AgentRunStateMachine,
  BUILTIN_AGENTS,
  type AgentRuntime,
  type SkillDefinition,
} from '../../src/agent/index.js';
import {
  SkillRegistry,
  SkillResolver,
  SkillLoader,
  validateSkill,
} from '../../src/skill/index.js';
import {
  ToolPolicy,
  ToolRegistry,
  ToolRuntime,
} from '../../src/tool/index.js';
import { apiBuilderToolContributions } from '../../src/tool/index.js';
import {
  buildAgentPlatform,
} from '../../src/bootstrap/agent-platform.js';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ApiDefinitionService } from '../../src/builder/service/api-definition-service.js';
import { ContractCompiler } from '../../src/builder/compiler/index.js';
import { DefinitionValidator } from '../../src/builder/domain/validator.js';
import { CompatibilityAnalyzer } from '../../src/builder/domain/compatibility.js';
import { InMemoryDraftStore } from '../../src/builder/store/in-memory.js';
import { EventBus } from '../../src/core/events.js';
import { OperationStore } from '../../src/core/operations.js';
import { AiService } from '../../src/ai/runtime/ai-runtime.js';
import { AiModelCatalog } from '../../src/ai/catalog/model-catalog.js';
import { AiProviderRegistry } from '../../src/ai/providers/provider-registry.js';
import { ModelRouter } from '../../src/ai/runtime/model-router.js';
import type { AiProviderAdapter } from '../../src/ai/providers/provider-adapter.js';

function stubAi(): AiService {
  const registry = new AiProviderRegistry();
  const adapter: AiProviderAdapter = {
    providerId: 'stub',
    supports: () => true,
    generate: async () => ({ content: 'planned work', usage: { inputTokens: 2, outputTokens: 3 } }),
    stream: async function* () {},
  };
  registry.register({ provider: { id: 'stub', name: 'Stub', type: 'native', enabled: true, priority: 1 }, adapter });
  const catalog = new AiModelCatalog();
  const router = new ModelRouter(catalog, registry, { defaultProfile: 'auto', enabledProviders: [] });
  return new AiService({ router, catalog, providers: registry });
}

function stubBuilder(): ApiDefinitionService {
  return new ApiDefinitionService({
    store: new InMemoryDraftStore(),
    compiler: new ContractCompiler(),
    validator: new DefinitionValidator(),
    analyzer: new CompatibilityAnalyzer(),
    operations: new OperationStore(),
    events: new EventBus(),
  });
}

describe('AGENT-002/019 agent registry', () => {
  it('registers the canonical built-in agents', () => {
    const registry = new AgentRegistry();
    for (const agent of BUILTIN_AGENTS) registry.register(agent);
    expect(registry.list().map((a) => a.role)).toEqual(expect.arrayContaining(['planner', 'developer', 'reviewer', 'verifier', 'observer']));
    expect(registry.has('vestara-developer')).toBe(true);
  });
});

describe('TOOL-001/002 tool registry + contributions', () => {
  it('registers API Builder capability contributions as tools', () => {
    const registry = new ToolRegistry();
    for (const c of apiBuilderToolContributions(stubBuilder())) registry.registerContribution(c);
    expect(registry.has('api.definition.read')).toBe(true);
    expect(registry.has('api.definition.validate')).toBe(true);
    expect(registry.listByCapability('builder.definition.read').map((t) => t.id)).toContain('api.definition.read');
  });
});

describe('TOOL-003/005/007 tool runtime', () => {
  it('auto-approves read/write and denies control without approval', async () => {
    const registry = new ToolRegistry();
    registry.registerContribution({
      toolId: 'test.read',
      version: '1',
      description: 'read tool',
      inputSchema: {},
      outputSchema: {},
      capabilities: ['test.read'],
      risk: 'read',
      handler: async () => ({ ok: true }),
    });
    registry.registerContribution({
      toolId: 'test.control',
      version: '1',
      description: 'control tool',
      inputSchema: {},
      outputSchema: {},
      capabilities: ['test.control'],
      risk: 'control',
      handler: async () => ({ ok: true }),
    });
    const policy = new ToolPolicy({ autoApproveRisks: ['read', 'write'] });
    const runtime = new ToolRuntime({ registry, policy });

    const read = await runtime.execute('agent-a', 'run-1', 'test.read', {});
    expect(read.ok).toBe(true);

    await expect(runtime.execute('agent-a', 'run-1', 'test.control', {})).rejects.toThrow(/requires human approval/);
    expect(runtime.listRecords().map((r) => r.status)).toContain('suspended');
  });

  it('allows control tools when approved', async () => {
    const registry = new ToolRegistry();
    registry.registerContribution({
      toolId: 'test.control',
      version: '1',
      description: 'control tool',
      inputSchema: {},
      outputSchema: {},
      capabilities: ['test.control'],
      risk: 'control',
      handler: async () => ({ applied: true }),
    });
    const runtime = new ToolRuntime({ registry, policy: new ToolPolicy({ autoApproveRisks: ['read'] }) });
    const result = await runtime.execute('agent-a', 'run-1', 'test.control', {}, { approved: true, authorizedBy: 'user-1' });
    expect(result.ok).toBe(true);
    const rec = runtime.listRecords()[0]!;
    expect(rec.approved).toBe(true);
    expect(rec.authorizedBy).toBe('user-1');
  });

  it('denies tools when the agent lacks the capability', async () => {
    const registry = new ToolRegistry();
    registry.registerContribution({
      toolId: 'api.definition.read',
      version: '1',
      description: 'read',
      inputSchema: {},
      outputSchema: {},
      capabilities: ['builder.definition.read'],
      risk: 'read',
      handler: async () => ({ ok: true }),
    });
    const runtime = new ToolRuntime({
      registry,
      policy: new ToolPolicy({ autoApproveRisks: ['read'] }),
      checkCapability: async () => false,
    });
    const result = await runtime.execute('agent-a', 'run-1', 'api.definition.read', {});
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/lacks the required capability/);
  });
});

describe('SKILL-001..005 skills', () => {
  it('validates a well-formed skill and rejects malformed ones', () => {
    const good: SkillDefinition = {
      id: 'vestara-api-builder',
      version: '1.0.0',
      name: 'API Builder',
      description: 'Turn requests into governed API definitions.',
      instructions: 'Plan, propose, validate, preview, request approval.',
      requiredCapabilities: ['builder.definition.read', 'builder.definition.create'],
    };
    expect(validateSkill(good).ok).toBe(true);
    expect(validateSkill({ ...good, id: 'Bad ID' }).ok).toBe(false);
    expect(validateSkill({ ...good, requiredCapabilities: [] }).ok).toBe(false);
  });

  it('loads a skill package from a directory', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'vestara-skill-'));
    await writeFile(join(dir, 'skill.json'), JSON.stringify({
      id: 'my-skill',
      version: '1.0.0',
      name: 'My Skill',
      description: 'd',
      instructions: 'unused; SKILL.md wins',
      requiredCapabilities: ['x.read'],
    }));
    await writeFile(join(dir, 'SKILL.md'), '# My Skill\n\nDo the thing.');
    const loader = new SkillLoader();
    const pkg = await loader.loadFromDirectory(dir);
    expect(pkg.manifest.id).toBe('my-skill');
    expect(pkg.instructionsMarkdown).toContain('Do the thing.');
  });

  it('resolves skills against agent capabilities', async () => {
    const registry = new SkillRegistry();
    registry.register({
      id: 's1',
      version: '1.0.0',
      name: 'S1',
      description: 'd',
      instructions: 'do',
      requiredCapabilities: ['a.read', 'b.write'],
    });
    const resolver = new SkillResolver({ capabilities: async () => new Set(['a.read']) });
    const check = await resolver.canUse('agent', registry.get('s1'));
    expect(check.ok).toBe(false);
    expect(check.issues.map((i) => i.path)).toContain('requiredCapabilities.b.write');

    const okResolver = new SkillResolver({ capabilities: async () => new Set(['a.read', 'b.write']) });
    expect((await okResolver.canUse('agent', registry.get('s1'))).ok).toBe(true);
  });
});

describe('AGENT-004/005 run state machine + runtime', () => {
  it('runs an agent through the lifecycle', async () => {
    const platform = buildAgentPlatform({ ai: stubAi(), builder: stubBuilder() });
    const run = platform.runtime.start({ agentId: 'vestara-planner', goal: 'Plan the commerce API' });
    expect(run.status).toBe('running');
    await new Promise((r) => setTimeout(r, 20));
    const final = platform.runs.get(run.id);
    expect(['completed', 'failed']).toContain(final.status);
    if (final.status === 'completed') {
      expect(final.result).toContain('planned work');
    }
    expect(platform.runs.eventsFor(run.id).length).toBeGreaterThan(0);
  });

  it('wires the verifier agent to the current verification control plane', () => {
    const platform = buildAgentPlatform({ ai: stubAi(), builder: stubBuilder() });
    expect(platform.tools.has('verification.latest')).toBe(true);
    expect(platform.tools.has('verification.run')).toBe(true);

    const verifier = platform.agents.get('vestara-verifier');
    expect(verifier.tools.map((tool) => tool.id)).toEqual(expect.arrayContaining(['verification.latest', 'verification.run']));
    expect(verifier.permissions).toEqual(expect.arrayContaining(['verification.read', 'verification.run']));
  });

  it('honors the run state machine', async () => {
    const runs = new AgentRunStateMachine();
    const run = runs.create('vestara-planner');
    runs.transition(run.id, 'preparing', { startedAt: new Date().toISOString() });
    runs.transition(run.id, 'running', { currentStep: 0 });
    runs.transition(run.id, 'waiting-for-approval');
    expect(() => runs.transition(run.id, 'completed')).toThrow(/Invalid AgentRun transition/);
    runs.transition(run.id, 'running');
    runs.transition(run.id, 'completed', { completedAt: new Date().toISOString() });
    expect(runs.get(run.id).status).toBe('completed');
  });
});

describe('tool evidence', () => {
  it('produces a deterministic evidence hash', async () => {
    const { toolEvidenceHash } = await import('../../src/tool/runtime/tool-runtime.js');
    const record = {
      executionId: 'e1',
      toolId: 't1',
      startedAt: '2026-01-01T00:00:00.000Z',
    };
    const a = toolEvidenceHash(record as never);
    const b = toolEvidenceHash(record as never);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
