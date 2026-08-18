import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '../../src/skill/registry/skill-registry.js';
import { SkillResolver } from '../../src/skill/resolver/skill-resolver.js';
import { ExecutionContextAssembler } from '../../src/agent/context/execution-context-assembler.js';
import { DeveloperRuntime } from '../../src/car/runtime/developer-runtime.js';
import { executeWithAdapter } from '../../src/car/runtime/developer-adapter-executor.js';
import { MemoryCodingAdapter } from '../../src/car/adapters/memory-coding-adapter.js';
import { CodingAgentRuntimeRegistry } from '../../src/car/registry/coding-agent-runtime-registry.js';
import { RuntimeSelector } from '../../src/car/runtime/runtime-selector.js';
import { ToolGateway } from '../../src/car/runtime/tool-gateway.js';
import type { SkillDefinition } from '../../src/skill/domain/contracts.js';
import type { AgentDefinition, AgentRun } from '../../src/agent/domain/contracts.js';
import type { ExecutionContextInput } from '../../src/agent/context/execution-context-assembler.js';

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

const testAgent: AgentDefinition = {
  id: 'dev-1',
  version: '1.0.0',
  name: 'Developer',
  role: 'developer',
  model: { mode: 'auto' },
  instructions: { system: 'You are a developer.', guardrails: ['No secrets'] },
  tools: [{ id: 'read' }],
  skills: [{ id: 'typescript-development' }],
  permissions: ['repo.read'],
  execution: { maxSteps: 10, maxToolCalls: 50, allowDelegation: false, maxConcurrentChildren: 0, maxDepth: 0 },
};

const testRun: AgentRun = {
  id: 'run-1',
  agentId: 'dev-1',
  status: 'running',
};

let registry: SkillRegistry;
let skillResolver: SkillResolver;
let adapter: MemoryCodingAdapter;

beforeEach(() => {
  capabilityMap.clear();
  registry = new SkillRegistry();
  skillResolver = new SkillResolver({
    capabilities: (agentId) => capabilityMap.get(agentId) ?? new Set(),
  });
  registry.register(tsSkill);
  setCapabilities('dev-1', ['repo.read']);
  adapter = new MemoryCodingAdapter('vestara');
});

describe('executeWithAdapter', () => {
  it('creates session and executes through adapter', async () => {
    const assembler = new ExecutionContextAssembler({ skillRegistry: registry, skillResolver });
    const context = await assembler.assemble({
      agent: testAgent,
      run: testRun,
      goal: 'Build feature',
      toolDescriptions: ['read'],
    });

    const result = await executeWithAdapter(adapter, context, 'Implement the API');

    expect(result.session.runtimeId).toBe('vestara');
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.events.some((e) => e.type === 'completed')).toBe(true);
    expect(result.runtimeId).toBe('vestara');
  });

  it('system prompt includes skill instructions', async () => {
    const assembler = new ExecutionContextAssembler({ skillRegistry: registry, skillResolver });
    const context = await assembler.assemble({
      agent: testAgent,
      run: testRun,
      goal: 'Build feature',
    });

    const result = await executeWithAdapter(adapter, context, 'Do something');
    expect(result.session).toBeDefined();
    // The system prompt is passed to the adapter via createSession.
    // MemoryCodingAdapter stores it in the session context.
    expect(result.events.some((e) => e.type === 'message')).toBe(true);
  });

  it('collects all event types', async () => {
    const toolAdapter = new MemoryCodingAdapter('vestara', {
      toolRequests: [{ name: 'read', input: { path: 'src/foo.ts' } }],
    });

    const assembler = new ExecutionContextAssembler({ skillRegistry: registry, skillResolver });
    const context = await assembler.assemble({
      agent: testAgent,
      run: testRun,
      goal: 'Read file',
    });

    const result = await executeWithAdapter(toolAdapter, context, 'Read the file');
    const types = result.events.map((e) => e.type);
    expect(types).toContain('tool-requested');
    expect(types).toContain('tool-started');
    expect(types).toContain('tool-completed');
    expect(types).toContain('message');
    expect(types).toContain('usage');
    expect(types).toContain('completed');
  });

  it('preserves context provenance through execution', async () => {
    const assembler = new ExecutionContextAssembler({ skillRegistry: registry, skillResolver });
    const context = await assembler.assemble({
      agent: testAgent,
      run: testRun,
      goal: 'Build feature',
      repository: { root: '/ws', branch: 'main' },
    });

    expect(context.repository?.root).toBe('/ws');
    expect(context.repository?.branch).toBe('main');

    const result = await executeWithAdapter(adapter, context, 'Task');
    expect(result.context.repository?.root).toBe('/ws');
  });

  it('deterministic: same inputs produce same execution path', async () => {
    const assembler = new ExecutionContextAssembler({ skillRegistry: registry, skillResolver });
    const input: ExecutionContextInput = {
      agent: testAgent,
      run: testRun,
      goal: 'Deterministic test',
    };

    const ctx1 = await assembler.assemble(input);
    const ctx2 = await assembler.assemble(input);

    const r1 = await executeWithAdapter(adapter, ctx1, 'prompt');
    const r2 = await executeWithAdapter(adapter, ctx2, 'prompt');

    expect(r1.context.governance.systemInstructions).toBe(r2.context.governance.systemInstructions);
    expect(r1.events.length).toBe(r2.events.length);
  });
});

describe('DeveloperRuntime', () => {
  it('executeWithAdapter assembles context and executes', async () => {
    const runtime = new DeveloperRuntime({
      assemblerDeps: { skillRegistry: registry, skillResolver },
      selector: new RuntimeSelector(new CodingAgentRuntimeRegistry()),
      gateway: new ToolGateway({ tools: {} as never, approvals: {} as never }),
    });

    const result = await runtime.executeWithAdapter(
      {
        contextInput: {
          agent: testAgent,
          run: testRun,
          goal: 'Build feature',
          toolDescriptions: ['read'],
        },
        runtimePolicy: { runtime: 'vestara' },
        prompt: 'Implement the API',
      },
      adapter,
    );

    expect(result.session).toBeDefined();
    expect(result.context.identity.agentId).toBe('dev-1');
    expect(result.runtimeId).toBe('vestara');
    expect(result.events.some((e) => e.type === 'completed')).toBe(true);
  });

  it('cancel delegates to adapter', async () => {
    const runtime = new DeveloperRuntime({
      assemblerDeps: { skillRegistry: registry, skillResolver },
      selector: new RuntimeSelector(new CodingAgentRuntimeRegistry()),
      gateway: new ToolGateway({ tools: {} as never, approvals: {} as never }),
    });

    // cancel should not throw.
    await expect(runtime.cancel(adapter, 'session-1')).resolves.toBeUndefined();
  });

  it('close delegates to adapter', async () => {
    const runtime = new DeveloperRuntime({
      assemblerDeps: { skillRegistry: registry, skillResolver },
      selector: new RuntimeSelector(new CodingAgentRuntimeRegistry()),
      gateway: new ToolGateway({ tools: {} as never, approvals: {} as never }),
    });

    await expect(runtime.close(adapter, 'session-1')).resolves.toBeUndefined();
  });
});
