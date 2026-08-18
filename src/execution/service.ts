import { hashOf } from '../generator/domain/hash.js';
import type { AgentRegistry } from '../agent/registry/agent-registry.js';
import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { TaskService } from '../task/service/task-service.js';
import type { WorkflowService } from '../workflow/service/workflow-service.js';
import type {
  Execution,
  ExecutionEvent,
  ExecutionPlan,
  ExecutionPreviewInput,
  ExecutionRequest,
} from './domain/contracts.js';
import { createExecutionId } from './domain/contracts.js';
import { CapabilityResolver } from './capability-resolver.js';
import { IntentResolver } from './intent-resolver.js';
import { WorkflowComposer } from './workflow-composer.js';
import type { ExecutionStore } from './store.js';
import { InMemoryExecutionStore } from './store.js';

export interface ExecutionServiceOptions {
  readonly capabilities: CapabilityRegistry;
  readonly agents?: AgentRegistry;
  readonly workflow?: WorkflowService;
  readonly tasks?: TaskService;
  readonly store?: ExecutionStore;
}

export interface ExecutionService {
  preview(input: ExecutionPreviewInput): ExecutionPlan;
  list(roomId?: string): readonly Execution[];
  get(executionId: string): Execution | null;
  start(executionId: string, patch?: Partial<Execution>): Execution;
  cancel(executionId: string): Execution;
}

export class ExecutionServiceImpl implements ExecutionService {
  private readonly store: ExecutionStore;
  private readonly intentResolver = new IntentResolver();
  private readonly capabilityResolver: CapabilityResolver;
  private readonly composer = new WorkflowComposer();

  constructor(private readonly options: ExecutionServiceOptions) {
    this.store = options.store ?? new InMemoryExecutionStore();
    this.capabilityResolver = new CapabilityResolver(options.capabilities);
  }

  preview(input: ExecutionPreviewInput): ExecutionPlan {
    const goal = input.goal.trim();
    const agentId = input.agentId.trim();
    const request = this.buildRequest(goal, agentId, input.roomId, input.principalId);
    const intent = this.intentResolver.resolve(goal);
    const capabilityResolution = this.capabilityResolver.resolve(intent);
    const plan = this.composer.compose({
      request,
      intent,
      capabilities: capabilityResolution.resolved,
      missingCapabilities: capabilityResolution.missing,
    });

    const existing = this.store.get(plan.executionId);
    const events = this.buildEvents(plan.executionId, request, intent, capabilityResolution.missing, existing?.events ?? []);
    const execution: Execution = {
      id: plan.executionId,
      request,
      status: plan.status,
      plan,
      events,
      lease: existing?.lease ?? this.buildLease(plan.executionId, request.agentId),
      createdAt: existing?.createdAt ?? request.requestedAt,
      updatedAt: plan.generatedAt,
      ...(existing?.startedAt !== undefined ? { startedAt: existing.startedAt } : {}),
      ...(existing?.completedAt !== undefined ? { completedAt: existing.completedAt } : {}),
      ...(existing?.result !== undefined ? { result: existing.result } : {}),
      ...(existing?.evidence !== undefined ? { evidence: existing.evidence } : {}),
    };

    this.store.upsert(execution);
    return plan;
  }

  list(roomId?: string): readonly Execution[] {
    return this.store.list(roomId);
  }

  get(executionId: string): Execution | null {
    return this.store.get(executionId);
  }

  start(executionId: string, patch?: Partial<Execution>): Execution {
    const existing = this.store.get(executionId);
    if (!existing) throw new Error(`Execution "${executionId}" not found`);
    const now = new Date().toISOString();
    const updated: Execution = {
      ...existing,
      ...patch,
      status: 'running',
      startedAt: now,
      updatedAt: now,
    };
    this.store.upsert(updated);
    return updated;
  }

  cancel(executionId: string): Execution {
    const existing = this.store.get(executionId);
    if (!existing) throw new Error(`Execution "${executionId}" not found`);
    const now = new Date().toISOString();
    const updated: Execution = {
      ...existing,
      status: 'cancelled',
      completedAt: now,
      updatedAt: now,
    };
    this.store.upsert(updated);
    return updated;
  }

  private buildRequest(goal: string, agentId: string, roomId: string | undefined, principalId: string | undefined): ExecutionRequest {
    const requestedAt = new Date().toISOString();
    const resolvedAgent = this.options.agents?.get(agentId);
    const actualRoomId = roomId ?? 'activity-room';
    return {
      id: createExecutionId({ goal, agentId, roomId: actualRoomId }),
      goal,
      agentId,
      ...(resolvedAgent ? { agentName: resolvedAgent.name } : {}),
      roomId: actualRoomId,
      ...(principalId !== undefined ? { principalId } : {}),
      requestedAt,
    };
  }

  private buildEvents(
    executionId: string,
    request: ExecutionRequest,
    intent: ReturnType<IntentResolver['resolve']>,
    missingCapabilities: readonly string[],
    previous: readonly ExecutionEvent[],
  ): readonly ExecutionEvent[] {
    const requestedAt = request.requestedAt;
    const eventBase = hashOf({ executionId, requestedAt, request: request.goal }).slice(0, 8);
    const existing = new Set(previous.map((event) => event.type));
    const events: ExecutionEvent[] = [...previous];
    if (!existing.has('requested')) {
      events.push({
        id: `evt_${eventBase}_requested`,
        executionId,
        type: 'requested',
        at: requestedAt,
        detail: request.goal,
        ...(request.principalId !== undefined ? { actorId: request.principalId } : {}),
      });
    }
    if (!existing.has('intent-resolved')) {
      events.push({
        id: `evt_${eventBase}_intent`,
        executionId,
        type: 'intent-resolved',
        at: new Date().toISOString(),
        actorId: request.agentId,
        detail: `${intent.kind} · ${intent.target}`,
      });
    }
    if (!existing.has('capabilities-resolved')) {
      events.push({
        id: `evt_${eventBase}_caps`,
        executionId,
        type: 'capabilities-resolved',
        at: new Date().toISOString(),
        actorId: request.agentId,
        detail: missingCapabilities.length > 0 ? `missing: ${missingCapabilities.join(', ')}` : 'all required capabilities available',
      });
    }
    if (!existing.has('plan-composed')) {
      events.push({
        id: `evt_${eventBase}_plan`,
        executionId,
        type: 'plan-composed',
        at: new Date().toISOString(),
        actorId: request.agentId,
        detail: 'execution plan composed',
      });
    }
    return events;
  }

  private buildLease(executionId: string, holder: string): { id: string; executionId: string; holder: string; issuedAt: string; expiresAt: string } {
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    return {
      id: `lease_${hashOf({ executionId, holder, issuedAt }).slice(0, 10)}`,
      executionId,
      holder,
      issuedAt,
      expiresAt,
    };
  }
}
