import { describe, expect, it } from 'vitest';
import {
  ContextProviderRegistry,
  ContextCollector,
  ContextSnapshotStore,
  ContextService,
  AgentContextProvider,
  WorkflowContextProvider,
  FileContextProvider,
  estimateTokens,
  computeBudget,
  bundleHash,
  type ContextItem,
  type ContextProvider,
  type ContextCollectionRequest,
} from '../../src/context/index.js';
import { AgentRegistry, BUILTIN_AGENTS } from '../../src/agent/index.js';
import { FileService, MemoryProvider, type FileWorkspace } from '../../src/file/index.js';

function collectorWith(providers: ContextProvider[], authorize?: (principalId: string, item: ContextItem) => boolean) {
  const registry = new ContextProviderRegistry();
  for (const provider of providers) registry.register(provider);
  return new ContextCollector({ registry, ...(authorize ? { authorize } : {}), defaultBudget: { maximumTokens: 128_000, reservedOutputTokens: 8_000, reservedSystemTokens: 8_000 } });
}

describe('CTX-001 contracts', () => {
  it('estimates tokens', () => {
    expect(estimateTokens('hello world')).toBe(3);
    expect(estimateTokens('')).toBe(1);
  });

  it('computes a budget with reserved tokens', () => {
    const budget = computeBudget({ maximumTokens: 128_000, reservedOutputTokens: 8_000, reservedSystemTokens: 8_000 });
    expect(budget.availableContextTokens).toBe(112_000);
  });
});

describe('CTX-015 agent context provider', () => {
  it('collects instructions, tools, skills, permissions and task', async () => {
    const agents = new AgentRegistry();
    for (const a of BUILTIN_AGENTS) agents.register(a);
    const provider = new AgentContextProvider(agents);
    const request: ContextCollectionRequest = {
      purpose: 'agent-execution',
      principalId: 'user-1',
      scope: 'agent',
      agentId: 'vestara-developer',
      task: 'Implement auth validation',
    };
    const items = await provider.collect(request);
    const sources = items.map((i) => i.source);
    expect(sources).toContain('instruction');
    expect(sources).toContain('tool');
    expect(sources).toContain('skill');
    expect(sources).toContain('system');
    expect(sources).toContain('task');
    const instructions = items.find((i) => i.source === 'instruction')!;
    expect(instructions.required).toBe(true);
    expect(instructions.content).toContain('Vestara developer');
  });
});

describe('CTX-005..011 collector pipeline', () => {
  it('collects, ranks and budgets into a bundle', async () => {
    const agents = new AgentRegistry();
    for (const a of BUILTIN_AGENTS) agents.register(a);
    const registry = new ContextProviderRegistry();
    registry.register(new AgentContextProvider(agents));
    registry.register(simpleProvider('files', ['file', 'code'], [
      { id: 'file:src/app.ts', source: 'code', content: 'x'.repeat(1000), priority: 10, required: false, sensitive: false, metadata: {} },
      { id: 'file:docs/guide.md', source: 'file', content: 'guide', priority: 5, required: false, sensitive: false, metadata: {} },
    ]));
    const collector = new ContextCollector({ registry, defaultBudget: { maximumTokens: 128_000, reservedOutputTokens: 8_000, reservedSystemTokens: 8_000 } });
    const bundle = await collector.collect({ purpose: 'agent-execution', principalId: 'u', scope: 'agent', agentId: 'vestara-developer' });
    expect(bundle.items.some((i) => i.source === 'instruction')).toBe(true);
    expect(bundle.items.some((i) => i.source === 'code')).toBe(true);
    expect(bundle.budget.availableContextTokens).toBe(112_000);
    expect(bundle.provenance.length).toBe(bundle.items.length);
  });

  it('applies the authorization filter - context access != agent access', async () => {
    const agents = new AgentRegistry();
    for (const a of BUILTIN_AGENTS) agents.register(a);
    const registry = new ContextProviderRegistry();
    registry.register(new AgentContextProvider(agents));
    registry.register(simpleProvider('secrets', ['file'], [
      { id: 'secret:1', source: 'file', content: 'TOP SECRET', priority: 100, required: false, sensitive: true, metadata: {} },
    ]));
    const collector = new ContextCollector({
      registry,
      authorize: () => true,
      allowSensitive: () => false,
      defaultBudget: { maximumTokens: 128_000, reservedOutputTokens: 8_000, reservedSystemTokens: 8_000 },
    });
    const bundle = await collector.collect({ purpose: 'agent-execution', principalId: 'agent-1', scope: 'agent' });
    expect(bundle.items.some((i) => i.content === 'TOP SECRET')).toBe(false);
  });

  it('keeps required items even when the budget is tight', async () => {
    const agents = new AgentRegistry();
    for (const a of BUILTIN_AGENTS) agents.register(a);
    const registry = new ContextProviderRegistry();
    registry.register(new AgentContextProvider(agents));
    registry.register(simpleProvider('big', ['memory'], [
      { id: 'big:1', source: 'memory', content: 'y'.repeat(10_000), priority: 1, required: false, sensitive: false, metadata: {} },
    ]));
    const collector = new ContextCollector({ registry, defaultBudget: { maximumTokens: 128_000, reservedOutputTokens: 8_000, reservedSystemTokens: 8_000 } });
    const bundle = await collector.collect({ purpose: 'agent-execution', principalId: 'u', scope: 'agent', agentId: 'vestara-developer' });
    expect(bundle.items.some((i) => i.required && i.source === 'instruction')).toBe(true);
  });
});

describe('CTX-013 snapshots + hashes', () => {
  it('creates a reproducible snapshot with a bundle hash', async () => {
    const agents = new AgentRegistry();
    for (const a of BUILTIN_AGENTS) agents.register(a);
    const registry = new ContextProviderRegistry();
    registry.register(new AgentContextProvider(agents));
    const collector = new ContextCollector({ registry, defaultBudget: { maximumTokens: 128_000, reservedOutputTokens: 8_000, reservedSystemTokens: 8_000 } });
    const store = new ContextSnapshotStore();
    const service = new ContextService({ registry, collector, snapshots: store });

    const bundle = await service.collect({ purpose: 'agent-execution', principalId: 'u', scope: 'agent', agentId: 'vestara-developer', task: 'task' });
    const snapshot = service.snapshot(bundle, { runId: 'run_1', agentId: 'vestara-developer' });
    expect(snapshot.bundleHash).toMatch(/^[a-f0-9]{64}$/);
    expect(snapshot.runId).toBe('run_1');
    expect(snapshot.items.length).toBe(bundle.items.length);
    expect(service.getSnapshot(snapshot.id)?.bundleHash).toBe(snapshot.bundleHash);
    expect(bundleHash(bundle)).toBe(snapshot.bundleHash);
  });
});

describe('CTX-017 file context provider + workflow provider', () => {
  it('collects file contents as context candidates', async () => {
    const provider = new MemoryProvider('memory');
    provider.seed('workspace://dev/src/app.ts', 'export const app = 1;');
    const file = new FileService({ providers: { memory: provider } });
    const ws: FileWorkspace = { id: 'dev', name: 'dev', root: 'workspace://dev/', providerId: 'memory', revision: 1 };
    file.mountWorkspace(ws);
    const fileProvider = new FileContextProvider(file, 'dev', ['src/app.ts']);
    const items = await fileProvider.collect({ purpose: 'retrieval', principalId: 'u', scope: 'workspace' });
    expect(items).toHaveLength(1);
    expect(items[0]!.source).toBe('code');
  });

  it('collects workflow run state', async () => {
    const provider = new WorkflowContextProvider((runId) => ({
      id: runId,
      workflowId: 'feature',
      version: '1.0.0',
      status: 'running',
      inputs: {},
      context: {},
      steps: [{ stepId: 'plan', name: 'Plan', kind: 'agent', status: 'completed', attempts: 1 }],
    }));
    const items = await provider.collect({ purpose: 'workflow-step', principalId: 'u', scope: 'workflow', workflowRunId: 'wf_1' });
    expect(items).toHaveLength(1);
    expect(items[0]!.content).toContain('feature@1.0.0');
  });
});

function simpleProvider(id: string, kinds: ContextProvider['kinds'], items: readonly ContextItem[]): ContextProvider {
  return {
    id,
    kinds,
    scope: 'run',
    collect: async () => items,
  };
}
