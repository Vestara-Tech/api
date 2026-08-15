import type {
  ContextBundle,
  ContextCollectionRequest,
  ContextSnapshot,
} from '../domain/contracts.js';
import { ContextCollector } from '../collector/context-collector.js';
import { ContextProviderRegistry } from '../providers/context-provider-registry.js';
import { ContextSnapshotStore } from '../store/context-snapshot-store.js';

export interface ContextServiceOptions {
  readonly registry: ContextProviderRegistry;
  readonly collector: ContextCollector;
  readonly snapshots: ContextSnapshotStore;
}

export interface ContextService {
  collect(request: ContextCollectionRequest): Promise<ContextBundle>;
  snapshot(bundle: ContextBundle, refs?: { runId?: string; agentId?: string; workflowRunId?: string }): ContextSnapshot;
  listSnapshots(): readonly ContextSnapshot[];
  getSnapshot(id: string): ContextSnapshot | undefined;
  providers(): readonly { id: string; kinds: readonly string[]; scope: string }[];
}

/** CTX — Context service facade. */
export class ContextService implements ContextService {
  private readonly registry: ContextProviderRegistry;
  private readonly collector: ContextCollector;
  private readonly snapshots: ContextSnapshotStore;

  constructor(options: ContextServiceOptions) {
    this.registry = options.registry;
    this.collector = options.collector;
    this.snapshots = options.snapshots;
  }

  collect(request: ContextCollectionRequest): Promise<ContextBundle> {
    return this.collector.collect(request);
  }

  snapshot(bundle: ContextBundle, refs?: { runId?: string; agentId?: string; workflowRunId?: string }): ContextSnapshot {
    return this.snapshots.create(bundle, refs ?? {});
  }

  listSnapshots(): readonly ContextSnapshot[] {
    return this.snapshots.list();
  }

  getSnapshot(id: string): ContextSnapshot | undefined {
    return this.snapshots.get(id);
  }

  providers(): readonly { id: string; kinds: readonly string[]; scope: string }[] {
    return this.registry.list().map((p) => ({ id: p.id, kinds: p.kinds, scope: p.scope }));
  }
}
