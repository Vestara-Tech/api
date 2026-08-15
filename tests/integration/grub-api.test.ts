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

describe('GRUB configuration control API', () => {
  it('exposes the GRUB capability set and forbids raw writes', async () => {
    const ids = app.application.system.capabilities().map((c) => c.id);
    expect(ids).toContain('system.boot.grub.configuration.apply');
    expect(ids).toContain('system.boot.grub.entry.setNext');
    expect(ids).not.toContain('system.boot.grub.rawConfigWrite');
    expect(app.application.grubConfiguration).toBeDefined();
  });

  it('reports GRUB capabilities via the API', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system/boot/grub/capabilities' });
    expect(res.statusCode).toBe(200);
    const caps = res.json();
    // Dev environment: adapter reports unavailable
    expect(typeof caps.read).toBe('boolean');
  });

  it('validates a configuration proposal and rejects dangerous kernel params', async () => {
    const ok = await app.inject({
      method: 'POST',
      url: '/api/v2/system/boot/grub/validate',
      payload: { timeoutSeconds: 10, timeoutStyle: 'countdown', kernelParameters: ['quiet', 'splash'], recovery: { enabled: true }, osProber: { enabled: true } },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().validation.ok).toBe(true);

    const bad = await app.inject({
      method: 'POST',
      url: '/api/v2/system/boot/grub/validate',
      payload: { timeoutSeconds: 10, timeoutStyle: 'countdown', kernelParameters: ['single'], recovery: { enabled: true }, osProber: { enabled: true } },
    });
    expect(bad.json().validation.ok).toBe(false);
    expect(bad.json().validation.issues.join(' ')).toContain('blocked');
  });

  it('rejects apply without approval', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/system/boot/grub/apply',
      payload: { approved: false, configuration: { timeoutSeconds: 10, timeoutStyle: 'countdown', kernelParameters: ['quiet'], recovery: { enabled: true }, osProber: { enabled: true } } },
    });
    expect(res.statusCode).toBe(403);
  });

  it('set default entry 404s for unknown entries', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v2/system/boot/grub/default', payload: { entryId: 'nope' } });
    expect(res.statusCode).toBe(404);
  });
});
