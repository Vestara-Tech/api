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

describe('system V2 control API (SYS-026..056)', () => {
  it('captures the system snapshot', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system/snapshot' });
    expect(res.statusCode).toBe(200);
    const snapshot = res.json();
    expect(snapshot.capturedAt).toBeTruthy();
    expect(snapshot.cpu.logicalCores).toBeGreaterThan(0);
  });

  it('lists services and kernel info', async () => {
    const services = await app.inject({ method: 'GET', url: '/api/v2/system/services' });
    expect(services.statusCode).toBe(200);
    expect(services.json().length).toBeGreaterThan(0);

    const kernel = await app.inject({ method: 'GET', url: '/api/v2/system/kernel' });
    expect(kernel.json().release).toBeTruthy();
  });

  it('reads storage disks and mounts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system/storage' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().disks)).toBe(true);
    expect(Array.isArray(res.json().mounts)).toBe(true);
  });

  it('journals a privileged operation through request -> approve -> execute', async () => {
    const request = await app.inject({
      method: 'POST',
      url: '/api/v2/system/operations',
      payload: { kind: 'system.service.restart', target: 'vestara-api.service', requestedBy: 'user1' },
    });
    expect(request.statusCode).toBe(201);
    const entry = request.json();
    expect(entry.status).toBe('requested');
    expect(entry.risk).toBe('high');

    const approve = await app.inject({
      method: 'POST',
      url: `/api/v2/system/operations/${entry.id}/approve`,
      payload: { approvedBy: 'approver' },
    });
    expect(approve.json().status).toBe('approved');

    const execute = await app.inject({ method: 'POST', url: `/api/v2/system/operations/${entry.id}/execute` });
    expect(execute.json().status).toBe('failed');
    expect(execute.json().error).toContain('vestara-systemd');

    const journal = await app.inject({ method: 'GET', url: '/api/v2/system/operations' });
    expect(journal.json().some((j: { id: string }) => j.id === entry.id)).toBe(true);

    const get = await app.inject({ method: 'GET', url: `/api/v2/system/operations/${entry.id}` });
    expect(get.json().id).toBe(entry.id);
  });
});
