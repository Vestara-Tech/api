import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';
import { makeProductDefinition } from '../helpers/definition.js';

let app: Awaited<ReturnType<typeof buildApp>>;

beforeEach(async () => {
  const config = loadConfig({});
  const application = createApplication(config);
  app = await buildApp({ config, application });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

async function createDefinition(): Promise<{ id: string; revision: number }> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v2/builder/definitions',
    payload: { name: 'Products', namespace: 'catalog', version: '1.0.0' },
  });
  expect(res.statusCode).toBe(201);
  const body = res.json() as { id: string; revision: number };
  return { id: body.id, revision: body.revision };
}

describe('builder definitions CRUD', () => {
  it('creates, gets, and lists definitions', async () => {
    const { id } = await createDefinition();
    const getRes = await app.inject({ method: 'GET', url: `/api/v2/builder/definitions/${id}` });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().name).toBe('Products');

    const listRes = await app.inject({ method: 'GET', url: '/api/v2/builder/definitions' });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json();
    expect(list.total).toBe(1);
    expect(list.items[0].id).toBe(id);
    expect(list.nextCursor).toBeNull();
  });

  it('returns 404 for an unknown definition', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/builder/definitions/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('NOT_FOUND');
  });
});

describe('optimistic concurrency (If-Match)', () => {
  it('applies an update with a matching revision', async () => {
    const { id } = await createDefinition();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v2/builder/definitions/${id}`,
      headers: { 'if-match': 'revision-0' },
      payload: { version: '1.1.0' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().version).toBe('1.1.0');
  });

  it('returns 409 on a stale revision', async () => {
    const { id } = await createDefinition();
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v2/builder/definitions/${id}`,
      headers: { 'if-match': 'revision-5' },
      payload: { version: '9.9.9' },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
  });

  it('publish respects the expected revision', async () => {
    const { id } = await createDefinition();
    // Seed a valid definition and validate it to READY.
    const seeded = makeProductDefinition({ id });
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v2/builder/definitions/${id}`,
      headers: { 'if-match': 'revision-0' },
      payload: { resources: seeded.resources, endpoints: seeded.endpoints, policies: seeded.policies },
    });
    expect(patchRes.statusCode).toBe(200);
    await app.inject({ method: 'POST', url: `/api/v2/builder/definitions/${id}/validate` });

    const stale = await app.inject({
      method: 'POST',
      url: `/api/v2/builder/definitions/${id}/publish`,
      headers: { 'if-match': 'revision-9' },
    });
    expect(stale.statusCode).toBe(409);

    const ok = await app.inject({
      method: 'POST',
      url: `/api/v2/builder/definitions/${id}/publish`,
      headers: { 'if-match': 'revision-0' },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().definition.status).toBe('published');
    expect(ok.json().operationId).toMatch(/^op_/);
  });
});

describe('preview contract', () => {
  it('returns definition + validation + contract + compatibility + publishable', async () => {
    const { id } = await createDefinition();
    const seeded = makeProductDefinition({ id });
    await app.inject({
      method: 'PATCH',
      url: `/api/v2/builder/definitions/${id}`,
      headers: { 'if-match': 'revision-0' },
      payload: { resources: seeded.resources, endpoints: seeded.endpoints },
    });
    await app.inject({ method: 'POST', url: `/api/v2/builder/definitions/${id}/validate` });

    const res = await app.inject({ method: 'POST', url: `/api/v2/builder/definitions/${id}/preview` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.validation.ok).toBe(true);
    expect(body.contract.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(body.contract.compilerVersion).toBe('1.0.0');
    expect(body.contract.openapi.openapi).toBe('3.1.0');
    expect(body.contract.routes.length).toBeGreaterThan(0);
    expect(body.compatibility.classification).toBe('compatible');
    expect(body.publishable).toBe(true);
  });
});

describe('revisions and rollback', () => {
  it('lists revisions and fetches a specific one', async () => {
    const { id } = await createDefinition();
    const seeded = makeProductDefinition({ id });
    await app.inject({
      method: 'PATCH',
      url: `/api/v2/builder/definitions/${id}`,
      headers: { 'if-match': 'revision-0' },
      payload: { resources: seeded.resources, endpoints: seeded.endpoints },
    });
    await app.inject({ method: 'POST', url: `/api/v2/builder/definitions/${id}/validate` });
    await app.inject({ method: 'POST', url: `/api/v2/builder/definitions/${id}/publish` });

    const listRes = await app.inject({ method: 'GET', url: `/api/v2/builder/definitions/${id}/revisions` });
    expect(listRes.statusCode).toBe(200);
    const revisions = listRes.json();
    expect(revisions).toHaveLength(1);
    expect(revisions[0].compiledHash).toMatch(/^[a-f0-9]{64}$/);

    const oneRes = await app.inject({ method: 'GET', url: `/api/v2/builder/definitions/${id}/revisions/1` });
    expect(oneRes.statusCode).toBe(200);
    expect(oneRes.json().definition.revision).toBe(1);

    const missingRes = await app.inject({ method: 'GET', url: `/api/v2/builder/definitions/${id}/revisions/42` });
    expect(missingRes.statusCode).toBe(404);
  });
});

describe('pagination and filtering', () => {
  it('supports status filter and search', async () => {
    await createDefinition();
    await createDefinition();

    const res = await app.inject({ method: 'GET', url: '/api/v2/builder/definitions?status=draft&search=products&limit=1' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.total).toBe(2);
    expect(body.items).toHaveLength(1);
    expect(body.nextCursor).toBe('1');
  });
});
