import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';

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

describe('permission control API (PERM-019)', () => {
  it('exposes the permissions capability', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('permissions');
  });

  it('lists permission definitions and roles', async () => {
    const defs = await app.inject({ method: 'GET', url: '/api/v2/permissions' });
    expect(defs.statusCode).toBe(200);
    const ids = defs.json().map((d: { id: string }) => d.id);
    expect(ids).toContain('file.write');
    expect(ids).toContain('generator.apply');
    expect(ids).toContain('system.firmware.logo.apply');

    const roles = await app.inject({ method: 'GET', url: '/api/v2/permissions/roles' });
    expect(roles.json().map((r: { id: string }) => r.id)).toContain('engineering.developer');
  });

  it('evaluates a permission request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/permissions/evaluate',
      payload: { permission: 'file.read', principalId: 'dev-1' },
    });
    expect(res.statusCode).toBe(200);
    expect(['allow', 'deny', 'approval-required', 'constrained']).toContain(res.json().effect);
  });

  it('grants a permission and lists effective permissions', async () => {
    const grant = await app.inject({
      method: 'POST',
      url: '/api/v2/permissions/grants',
      payload: { principalId: 'dev-1', permission: 'file.write' },
    });
    expect(grant.statusCode).toBe(201);

    const effective = await app.inject({ method: 'GET', url: '/api/v2/permissions/effective?principalId=dev-1' });
    expect(effective.statusCode).toBe(200);
    expect(effective.json()).toContain('file.write');
  });

  it('delegates only permissions the delegator possesses', async () => {
    // Grant the delegator file.read + file.write, then attempt to delegate
    // file.delete too.
    await app.inject({ method: 'POST', url: '/api/v2/permissions/grants', payload: { principalId: 'planner', permission: 'file.read' } });
    await app.inject({ method: 'POST', url: '/api/v2/permissions/grants', payload: { principalId: 'planner', permission: 'file.write' } });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/permissions/delegate',
      payload: { delegatorId: 'planner', delegateeId: 'dev-2', permissions: ['file.read', 'file.write', 'file.delete'] },
    });
    expect(res.statusCode).toBe(200);
    const delegated = res.json().delegated as string[];
    expect(delegated).toContain('file.read');
    expect(delegated).toContain('file.write');
    expect(delegated).not.toContain('file.delete');
  });

  it('issues and lists temporary grants', async () => {
    const issue = await app.inject({
      method: 'POST',
      url: '/api/v2/permissions/temporary',
      payload: { principalId: 'dev-3', permission: 'database.schema.modify', reason: 'migration', durationSeconds: 300 },
    });
    expect(issue.statusCode).toBe(201);
    expect(issue.json().permission).toBe('database.schema.modify');

    const list = await app.inject({ method: 'GET', url: '/api/v2/permissions/temporary?principalId=dev-3' });
    expect(list.json().length).toBeGreaterThan(0);
  });
});
