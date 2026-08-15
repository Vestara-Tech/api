import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';
import { MemoryProvider } from '../../src/file/index.js';

let app: Awaited<ReturnType<typeof buildApp>>;

beforeEach(async () => {
  const config = loadConfig({});
  const application = createApplication(config);
  app = await buildApp({ config, application });
  await app.ready();
  // Mount a memory workspace backed by the application's file service provider.
  const provider = new MemoryProvider('memory');
  provider.seed('workspace://dev/src/app.ts', 'export const app = 1;');
  (app.application.file.service as { providers: Record<string, MemoryProvider> }).providers = { memory: provider };
});

afterEach(async () => {
  await app.close();
});

describe('file control API (FILE)', () => {
  it('exposes the files capability', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('files');
  });

  it('mounts and lists workspaces', async () => {
    const mount = await app.inject({
      method: 'POST',
      url: '/api/v2/files/workspaces',
      payload: { id: 'dev', name: 'dev', root: 'workspace://dev/', providerId: 'memory' },
    });
    expect(mount.statusCode).toBe(201);

    const list = await app.inject({ method: 'GET', url: '/api/v2/files/workspaces' });
    expect(list.json().map((w: { id: string }) => w.id)).toContain('dev');
  });

  it('reads and lists files', async () => {
    await app.inject({ method: 'POST', url: '/api/v2/files/workspaces', payload: { id: 'dev', name: 'dev', root: 'workspace://dev/', providerId: 'memory', include: ['src/**'] } });

    const read = await app.inject({ method: 'GET', url: '/api/v2/files/workspaces/dev/read?path=src%2Fapp.ts' });
    expect(read.statusCode).toBe(200);
    expect(read.json().content).toContain('export const app');

    const listRes = await app.inject({ method: 'GET', url: '/api/v2/files/workspaces/dev/list?path=src' });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().map((r: { name: string }) => r.name)).toContain('app.ts');
  });

  it('rejects reads outside include patterns', async () => {
    await app.inject({ method: 'POST', url: '/api/v2/files/workspaces', payload: { id: 'dev', name: 'dev', root: 'workspace://dev/', providerId: 'memory', include: ['src/**'] } });
    const res = await app.inject({ method: 'GET', url: '/api/v2/files/workspaces/dev/read?path=other.ts' });
    expect(res.statusCode).toBe(403);
  });

  it('applies a governed transaction', async () => {
    await app.inject({ method: 'POST', url: '/api/v2/files/workspaces', payload: { id: 'dev', name: 'dev', root: 'workspace://dev/', providerId: 'memory', include: ['src/**'] } });
    const create = await app.inject({
      method: 'POST',
      url: '/api/v2/files/transactions',
      payload: { workspaceId: 'dev', operations: [{ kind: 'create', path: 'src/new.ts', content: 'export const n = 1;' }] },
    });
    expect(create.statusCode).toBe(201);
    const txId = create.json().id;

    await app.inject({ method: 'POST', url: `/api/v2/files/transactions/${txId}/validate` });
    const apply = await app.inject({ method: 'POST', url: `/api/v2/files/transactions/${txId}/apply` });
    expect(apply.statusCode).toBe(200);
    expect(apply.json().status).toBe('applied');

    const versions = await app.inject({ method: 'GET', url: '/api/v2/files/workspaces/dev/versions?path=src%2Fnew.ts' });
    expect(versions.json()).toHaveLength(1);
  });

  it('lists file events', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/files/events' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });
});
