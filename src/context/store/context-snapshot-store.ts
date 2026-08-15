import { randomId } from '../../core/identifiers.js';
import type { ContextBundle, ContextSnapshot } from '../domain/contracts.js';
import { bundleHash } from '../collector/context-collector.js';

/**
 * CTX-013 — Context snapshots. Every significant execution is reproducible:
 * snapshot id + bundle hash + run/agent/workflow references + item list.
 */
export class ContextSnapshotStore {
  private readonly snapshots: ContextSnapshot[] = [];

  create(bundle: ContextBundle, refs: { runId?: string; agentId?: string; workflowRunId?: string } = {}): ContextSnapshot {
    const snapshot: ContextSnapshot = {
      id: randomId('ctx'),
      bundleHash: bundleHash(bundle),
      items: bundle.items.map((item) => ({
        itemId: item.id,
        source: item.source,
        scope: ((item.metadata ?? {}).scope as ContextSnapshot['items'][number]['scope'] | undefined) ?? 'run',
        tokenEstimate: item.tokenEstimate ?? Math.ceil(item.content.length / 4),
      })),
      createdAt: new Date().toISOString(),
      ...(refs.runId !== undefined ? { runId: refs.runId } : {}),
      ...(refs.agentId !== undefined ? { agentId: refs.agentId } : {}),
      ...(refs.workflowRunId !== undefined ? { workflowRunId: refs.workflowRunId } : {}),
    };
    this.snapshots.push(snapshot);
    return snapshot;
  }

  get(id: string): ContextSnapshot | undefined {
    return this.snapshots.find((s) => s.id === id);
  }

  list(): readonly ContextSnapshot[] {
    return [...this.snapshots].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}
