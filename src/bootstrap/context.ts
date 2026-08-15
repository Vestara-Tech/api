import type { AgentRegistry } from '../agent/registry/agent-registry.js';
import type { WorkflowRuntime } from '../workflow/runtime/workflow-runtime.js';
import type { FileService } from '../file/service/file-service.js';
import { ContextProviderRegistry } from '../context/providers/context-provider-registry.js';
import { ContextCollector } from '../context/collector/context-collector.js';
import { ContextSnapshotStore } from '../context/store/context-snapshot-store.js';
import { ContextService } from '../context/service/context-service.js';
import { AgentContextProvider } from '../context/providers/agent-context-provider.js';
import { WorkflowContextProvider } from '../context/providers/workflow-context-provider.js';
import { FileContextProvider } from '../context/providers/file-context-provider.js';

export interface ContextPlatformOptions {
  readonly agents: AgentRegistry;
  readonly workflow?: WorkflowRuntime;
  readonly file?: FileService;
  readonly fileWorkspaceId?: string;
  readonly filePaths?: readonly string[];
  readonly authorize?: (principalId: string, item: { sensitive: boolean; id: string; source: string }) => boolean;
}

export interface ContextPlatform {
  readonly registry: ContextProviderRegistry;
  readonly collector: ContextCollector;
  readonly snapshots: ContextSnapshotStore;
  readonly service: ContextService;
}

/** CTX — Composition root. Registers the first built-in providers. */
export function buildContextPlatform(options: ContextPlatformOptions): ContextPlatform {
  const registry = new ContextProviderRegistry();
  registry.register(new AgentContextProvider(options.agents));
  if (options.workflow) {
    registry.register(new WorkflowContextProvider((runId) => options.workflow!.getRun(runId)));
  }
  if (options.file && options.fileWorkspaceId) {
    registry.register(new FileContextProvider(options.file, options.fileWorkspaceId, options.filePaths ?? []));
  }

  const collector = new ContextCollector({
    registry,
    ...(options.authorize ? { authorize: options.authorize } : {}),
  });
  const snapshots = new ContextSnapshotStore();
  const service = new ContextService({ registry, collector, snapshots });
  return { registry, collector, snapshots, service };
}
