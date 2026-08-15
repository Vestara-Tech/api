import { notFound } from '../../core/errors.js';
import type { RequestContext } from '../../core/context.js';
import { EventBus, type VestaraEvent } from '../../core/events.js';
import { OperationStore } from '../../core/operations.js';
import { ContractCompiler } from '../compiler/index.js';
import { transition } from '../domain/lifecycle.js';
import type {
  ApiDefinition,
  ApiDefinitionRevision,
  CreateApiDefinitionInput,
  ValidationResult,
} from '../domain/types.js';
import { DefinitionValidator } from '../domain/validator.js';
import type { DraftStore } from '../store/draft-store.js';
import { randomId } from '../../core/identifiers.js';

export interface ApiDefinitionServiceOptions {
  readonly store: DraftStore;
  readonly compiler: ContractCompiler;
  readonly validator: DefinitionValidator;
  readonly operations: OperationStore;
  readonly events: EventBus;
}

export class ApiDefinitionService {
  private readonly store: DraftStore;
  private readonly compiler: ContractCompiler;
  private readonly validator: DefinitionValidator;
  private readonly operations: OperationStore;
  private readonly events: EventBus;

  constructor(options: ApiDefinitionServiceOptions) {
    this.store = options.store;
    this.compiler = options.compiler;
    this.validator = options.validator;
    this.operations = options.operations;
    this.events = options.events;
  }

  async create(input: CreateApiDefinitionInput): Promise<ApiDefinition> {
    const now = new Date().toISOString();
    const definition: ApiDefinition = {
      id: randomId('api'),
      name: input.name,
      namespace: input.namespace,
      version: input.version,
      status: 'draft',
      resources: [],
      endpoints: [],
      policies: [],
      operations: [],
      events: [],
      revision: 0,
      metadata: {
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.author !== undefined ? { author: input.author } : {}),
        createdAt: now,
        updatedAt: now,
      },
    };
    return this.store.create(definition);
  }

  async get(id: string): Promise<ApiDefinition> {
    const definition = await this.store.get(id);
    if (!definition) throw notFound(`Api definition "${id}" not found`);
    return definition;
  }

  async list(): Promise<readonly ApiDefinition[]> {
    return this.store.list();
  }

  async update(id: string, patch: Partial<Omit<ApiDefinition, 'id' | 'revision' | 'metadata'>>): Promise<ApiDefinition> {
    const current = await this.get(id);
    // A published definition is immutable; editing it starts a new draft cycle
    // on the same id (revision is preserved until the next publish).
    const status = current.status === 'published' || current.status === 'superseded' ? 'draft' : current.status;
    const next: ApiDefinition = {
      ...current,
      ...patch,
      id: current.id,
      revision: current.revision,
      status,
      metadata: { ...current.metadata, updatedAt: new Date().toISOString() },
    };
    return this.store.save(next);
  }

  async remove(id: string): Promise<boolean> {
    const current = await this.get(id);
    if (current.status === 'published') throw new Error(`Cannot delete published definition "${id}"`);
    return this.store.remove(id);
  }

  async validate(id: string): Promise<ValidationResult> {
    const current = await this.get(id);
    const validating = transition(current.status, 'validating');
    await this.store.save({ ...current, status: validating, metadata: { ...current.metadata, updatedAt: new Date().toISOString() } });

    const result = this.validator.validate(current);
    const nextStatus = result.ok ? 'ready' : 'draft';
    await this.store.save({ ...current, status: nextStatus, metadata: { ...current.metadata, updatedAt: new Date().toISOString() } });
    return result;
  }

  async preview(id: string) {
    const current = await this.get(id);
    return this.compiler.compile(current);
  }

  async publish(id: string, ctx: RequestContext): Promise<{ definition: ApiDefinition; operationId: string }> {
    const current = await this.get(id);

    // Publish is only allowed from READY.
    const publishing = transition(current.status, 'publishing');
    const operation = this.operations.create({ type: 'api.publish', resourceId: id });

    this.emit('builder.definition.publishing', {
      definitionId: id,
      operationId: operation.id,
      revision: current.revision,
    });

    await this.store.save({
      ...current,
      status: publishing,
      metadata: { ...current.metadata, updatedAt: new Date().toISOString() },
    });

    // Compile deterministically and record the revision with its contract hash.
    const compiled = this.compiler.compile(current);
    const now = new Date().toISOString();
    const published: ApiDefinition = {
      ...current,
      status: 'published',
      revision: current.revision + 1,
      metadata: { ...current.metadata, updatedAt: now },
    };

    const revision: ApiDefinitionRevision = {
      definition: published,
      compiledHash: compiled.hash,
      recordedAt: now,
    };
    await this.store.recordRevision(revision);
    await this.store.save(published);
    this.operations.updateStatus(operation.id, 'completed', { progress: 100 });

    this.emit('builder.definition.published', {
      definitionId: id,
      operationId: operation.id,
      revision: published.revision,
      compiledHash: compiled.hash,
    });

    return { definition: published, operationId: operation.id };
  }

  async rollback(id: string): Promise<ApiDefinition> {
    const current = await this.get(id);
    const revisions = await this.store.listRevisions(id);
    if (revisions.length < 2) throw new Error(`No prior revision to roll back to for "${id}"`);

    // Latest revision is the current published one; the one before it is the target.
    const target = revisions[revisions.length - 2]!;
    const superseded = { ...current, status: transition(current.status, 'superseded') } as ApiDefinition;

    const rolledBack: ApiDefinition = {
      ...target.definition,
      id: current.id,
      status: 'published',
      revision: current.revision + 1,
      metadata: { ...target.definition.metadata, updatedAt: new Date().toISOString() },
    };

    await this.store.save(superseded);
    await this.store.recordRevision({ definition: rolledBack, compiledHash: target.compiledHash, recordedAt: new Date().toISOString() });
    await this.store.save(rolledBack);

    this.emit('builder.definition.rolled-back', { definitionId: id, revision: rolledBack.revision });
    return rolledBack;
  }

  async revisions(id: string): Promise<readonly ApiDefinitionRevision[]> {
    await this.get(id);
    return this.store.listRevisions(id);
  }

  private emit(type: string, payload: Record<string, unknown>, correlationId?: string): void {
    const event: VestaraEvent = {
      type,
      category: 'domain',
      occurredAt: new Date().toISOString(),
      payload,
      ...(correlationId !== undefined ? { correlationId } : {}),
    };
    this.events.publish(event);
  }
}
