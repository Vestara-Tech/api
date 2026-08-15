import { describe, expect, it } from 'vitest';
import { ApiDefinitionService } from '../../src/builder/service/api-definition-service.js';
import { ContractCompiler } from '../../src/builder/compiler/index.js';
import { DefinitionValidator } from '../../src/builder/domain/validator.js';
import { InMemoryDraftStore } from '../../src/builder/store/in-memory.js';
import { createRequestContext } from '../../src/core/context.js';
import { EventBus } from '../../src/core/events.js';
import { OperationStore } from '../../src/core/operations.js';
import { makeProductDefinition } from '../helpers/definition.js';

function buildService(): {
  service: ApiDefinitionService;
  events: EventBus;
  operations: OperationStore;
} {
  const events = new EventBus();
  const operations = new OperationStore();
  const service = new ApiDefinitionService({
    store: new InMemoryDraftStore(),
    compiler: new ContractCompiler(),
    validator: new DefinitionValidator(),
    operations,
    events,
  });
  return { service, events, operations };
}

const ctx = createRequestContext();

describe('ApiDefinitionService', () => {
  it('creates a draft definition', async () => {
    const { service } = buildService();
    const def = await service.create({ name: 'Products', namespace: 'catalog', version: '1.0.0' });
    expect(def.status).toBe('draft');
    expect(def.revision).toBe(0);
    const fetched = await service.get(def.id);
    expect(fetched.id).toBe(def.id);
  });

  it('throws on unknown definition', async () => {
    const { service } = buildService();
    await expect(service.get('missing')).rejects.toThrow();
  });

  it('validates and moves to ready for a valid definition', async () => {
    const { service } = buildService();
    const def = await service.create({ name: 'Products', namespace: 'catalog', version: '1.0.0' });
    await service.update(def.id, { resources: makeProductDefinition().resources, endpoints: makeProductDefinition().endpoints });
    const result = await service.validate(def.id);
    expect(result.ok).toBe(true);
    expect((await service.get(def.id)).status).toBe('ready');
  });

  it('validation failure returns to draft', async () => {
    const { service } = buildService();
    const def = await service.create({ name: 'Products', namespace: 'catalog', version: 'latest' });
    const result = await service.validate(def.id);
    expect(result.ok).toBe(false);
    expect((await service.get(def.id)).status).toBe('draft');
  });

  it('publish requires ready state and records a hashed revision + operation', async () => {
    const { service, operations, events } = buildService();
    const def = await service.create({ name: 'Products', namespace: 'catalog', version: '1.0.0' });
    await service.update(def.id, { resources: makeProductDefinition().resources, endpoints: makeProductDefinition().endpoints });
    await service.validate(def.id);

    const publishedEvents: string[] = [];
    events.subscribe('builder.definition.published', (e) => publishedEvents.push(e.type));

    const result = await service.publish(def.id, ctx);
    expect(result.definition.status).toBe('published');
    expect(result.definition.revision).toBe(1);
    expect(result.operationId).toMatch(/^op_/);
    expect(operations.get(result.operationId)?.status).toBe('completed');

    const revisions = await service.revisions(def.id);
    expect(revisions).toHaveLength(1);
    expect(revisions[0]!.compiledHash).toMatch(/^[a-f0-9]{64}$/);
    expect(publishedEvents).toEqual(['builder.definition.published']);
  });

  it('rejects publish from a draft state', async () => {
    const { service } = buildService();
    const def = await service.create({ name: 'Products', namespace: 'catalog', version: '1.0.0' });
    await expect(service.publish(def.id, ctx)).rejects.toThrow();
  });

  it('rollback returns to the prior published revision', async () => {
    const { service } = buildService();
    const def = await service.create({ name: 'Products', namespace: 'catalog', version: '1.0.0' });
    await service.update(def.id, { resources: makeProductDefinition().resources, endpoints: makeProductDefinition().endpoints });
    await service.validate(def.id);
    await service.publish(def.id, ctx);

    // Modify + republish (revision 2)
    await service.update(def.id, { version: '1.0.1' });
    await service.validate(def.id);
    await service.publish(def.id, ctx);
    expect((await service.get(def.id)).version).toBe('1.0.1');

    const rolledBack = await service.rollback(def.id);
    expect(rolledBack.status).toBe('published');
    expect(rolledBack.version).toBe('1.0.0');
    expect(rolledBack.revision).toBe(3);

    const revisions = await service.revisions(def.id);
    expect(revisions).toHaveLength(3);
  });
});
