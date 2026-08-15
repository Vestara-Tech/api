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

describe('image platform V2 control API (IMG-031..041)', () => {
  it('lists hardware targets', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/image/hardware-targets' });
    expect(res.statusCode).toBe(200);
    const targets = res.json();
    expect(targets.some((t: { id: string }) => t.id === 'virtual-machine')).toBe(true);
    expect(targets.some((t: { id: string }) => t.id === 'raspberry-pi-4')).toBe(true);
  });

  it('validates a partition layout', async () => {
    const valid = await app.inject({
      method: 'POST',
      url: '/api/v2/image/partitions/validate',
      payload: {
        tableType: 'gpt',
        diskSizeBytes: 100 * 1024 * 1024 * 1024,
        partitions: [{ name: 'EFI', kind: 'efi', sizeBytes: 1024 * 1024 * 1024, filesystem: 'fat32' }],
      },
    });
    expect(valid.statusCode).toBe(200);
    expect(valid.json().ok).toBe(true);

    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v2/image/partitions/validate',
      payload: {
        tableType: 'gpt',
        diskSizeBytes: 1024 * 1024,
        partitions: [{ name: 'Root', kind: 'root', sizeBytes: 100 * 1024 * 1024 * 1024, filesystem: 'ext4' }],
      },
    });
    expect(invalid.json().ok).toBe(false);
    expect(invalid.json().issues.length).toBeGreaterThan(0);
  });

  it('advances a profile lifecycle', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/image/profiles/vestara-desktop/lifecycle' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('draft');

    const transition = await app.inject({
      method: 'POST',
      url: '/api/v2/image/profiles/vestara-desktop/transition',
      payload: { transition: 'validate' },
    });
    expect(transition.statusCode).toBe(200);
    expect(transition.json().status).toBe('validating');
  });

  it('compiles a BuildPlan V2', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/image/plan-v2',
      payload: { profileId: 'vestara-desktop', target: 'raw', hardwareId: 'virtual-machine' },
    });
    expect(res.statusCode).toBe(200);
    const plan = res.json();
    expect(plan.hardwareId).toBe('virtual-machine');
    expect(plan.items.length).toBeGreaterThan(10);
    expect(plan.partitionOk).toBe(true);
  });

  it('runs preflight with a verdict', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/image/preflight',
      payload: { profileId: 'vestara-desktop', target: 'raw', hardwareId: 'virtual-machine' },
    });
    expect(res.statusCode).toBe(200);
    const preflight = res.json();
    expect(['ready', 'ready-with-warnings', 'blocked']).toContain(preflight.verdict);
    expect(preflight.items.length).toBeGreaterThan(0);
  });

  it('creates and lists resumable build runs', async () => {
    const create = await app.inject({
      method: 'POST',
      url: '/api/v2/image/runs',
      payload: { profileId: 'vestara-desktop', target: 'raw' },
    });
    expect(create.statusCode).toBe(201);
    const run = create.json();
    expect(run.status).toBe('running');
    expect(run.stages.length).toBeGreaterThan(10);

    const list = await app.inject({ method: 'GET', url: '/api/v2/image/runs' });
    expect(list.json().some((r: { id: string }) => r.id === run.id)).toBe(true);

    const get = await app.inject({ method: 'GET', url: `/api/v2/image/runs/${run.id}` });
    expect(get.statusCode).toBe(200);
    expect(get.json().stages.length).toBeGreaterThan(10);
  });
});
