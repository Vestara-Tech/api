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

describe('system V2 daemon + approvals API (SYS-052..064)', () => {
  it('reports system health', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system/health' });
    expect(res.statusCode).toBe(200);
    const health = res.json();
    expect(health.api).toBe('running');
    expect(health.measuredAt).toBeTruthy();
  });

  it('requests a typed operation and runs it through approval + daemon', async () => {
    const request = await app.inject({
      method: 'POST',
      url: '/api/v2/system/daemon/execute',
      payload: { kind: 'system.service.restart', target: 'vestara-api.service', requestedBy: 'user1' },
    });
    expect(request.statusCode).toBe(201);
    const { journal, approval, rollbackPoint } = request.json();
    expect(journal.status).toBe('requested');
    expect(approval.status).toBe('pending');
    expect(approval.required).toBe(1);
    expect(rollbackPoint.operationId).toBe(journal.id);

    const approve = await app.inject({
      method: 'POST',
      url: `/api/v2/system/approvals/${approval.id}/approve`,
      payload: { approver: 'approver1' },
    });
    expect(approve.json().status).toBe('approved');

    const run = await app.inject({
      method: 'POST',
      url: `/api/v2/system/approvals/${approval.id}/run`,
      payload: { approver: 'approver1' },
    });
    expect(run.json().executed).toBe(true);
    expect(run.json().result.ok).toBe(false);

    const approvals = await app.inject({ method: 'GET', url: '/api/v2/system/approvals' });
    expect(approvals.json().some((a: { id: string }) => a.id === approval.id)).toBe(true);
  });

  it('reconciles desired configuration against current state', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/system/reconcile',
      payload: { desired: { 'system.hostname': 'new-host' } },
    });
    expect(res.statusCode).toBe(200);
    const result = res.json();
    expect(['in-sync', 'drift-detected']).toContain(result.status);
    expect(Array.isArray(result.diff)).toBe(true);
  });
});
