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

describe('system module wiring (SYS-001..014)', () => {
  it('exposes the system-module capability and service', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('system-module');
    expect(app.application.system).toBeDefined();
  });

  it('discovers environment hardware/firmware through the service', async () => {
    const discovery = await app.application.system.discover();
    expect(discovery.hardware.cpu.logicalCores).toBeGreaterThan(0);
    expect(discovery.hardware.memory.totalBytes).toBeGreaterThan(0);
    expect(['uefi', 'unknown', 'bios']).toContain(discovery.firmware.mode);
  });

  it('declares the full capability set including critical firmware ops', () => {
    const ids = app.application.system.capabilities().map((c) => c.id);
    expect(ids).toContain('system.firmware.logo.apply');
    expect(ids).toContain('system.boot.next.write');
    expect(ids).not.toContain('system.shell.root');
  });

  it('gates reboot on the capability permission', async () => {
    // No power control backend in the app, but authorization still gates first.
    const ctx = { principal: { kind: 'human', identityId: 'idn_1' }, scopes: [], roles: [], permissions: [], assurance: 2, correlation: {} };
    await expect(app.application.system.requestReboot(ctx)).rejects.toThrow();
  });
});
