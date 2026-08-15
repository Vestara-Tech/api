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

describe('boot presentation control API (SYS-025)', () => {
  it('exposes the boot-presentation capability set', async () => {
    const ids = app.application.system.capabilities().map((c) => c.id);
    expect(ids).toContain('system.boot.presentation.apply');
    expect(ids).toContain('system.boot.logo.apply');
    expect(ids).toContain('system.boot.logo.capabilities');
  });

  it('exposes the vestara.system.boot config namespace', () => {
    expect(app.application.configuration.registry.has('vestara.system.boot')).toBe(true);
    expect(app.application.configuration.resolve('vestara.system.boot.presentation.quietBoot')?.value).toBe(true);
  });

  it('rejects a raw filesystem path as an asset name', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/system/boot/presentation/assets',
      payload: { name: '../../etc/shadow', contentBase64: Buffer.from('x').toString('base64') },
    });
    expect(res.statusCode).toBe(400);
  });

  it('stores an asset and applies a profile through the governed flow', async () => {
    const assetRes = await app.inject({
      method: 'POST',
      url: '/api/v2/system/boot/presentation/assets',
      payload: { name: 'logo.png', contentBase64: Buffer.from('png-bytes').toString('base64') },
    });
    expect(assetRes.statusCode).toBe(201);
    const asset = assetRes.json();

    const profileRes = await app.inject({
      method: 'POST',
      url: '/api/v2/system/boot/presentation/profiles',
      payload: {
        id: 'p1',
        version: 1,
        name: 'Vestara Dark',
        plymouth: { logo: { assetId: asset.assetId, sha256: asset.sha256, mediaType: 'image/png' }, progressStyle: 'dots' },
      },
    });
    expect(profileRes.statusCode).toBe(201);

    const applyRes = await app.inject({
      method: 'POST',
      url: '/api/v2/system/boot/presentation/apply',
      payload: { profileId: 'p1', approved: true },
    });
    expect(applyRes.statusCode).toBe(200);
    expect(applyRes.json().requiresReboot).toBe(true);
    expect(app.application.bootPresentation.getState().status).toBe('pending-reboot-verification');

    const bootRes = await app.inject({
      method: 'POST',
      url: '/api/v2/system/boot/presentation/boot-result',
      payload: { succeeded: true },
    });
    expect(bootRes.json().status).toBe('verified');
  });

  it('firmware-logo apply requires special policy and reports unsupported on this hardware', async () => {
    const assetRes = await app.inject({
      method: 'POST',
      url: '/api/v2/system/boot/presentation/assets',
      payload: { name: 'fw.png', contentBase64: Buffer.from('fw').toString('base64') },
    });
    const asset = assetRes.json();
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/system/firmware/logo/apply',
      payload: { assetId: asset.assetId, specialPolicyApproved: false },
    });
    expect(res.statusCode).toBe(403); // special policy not approved

    const caps = await app.inject({ method: 'GET', url: '/api/v2/system/firmware/logo/capabilities' });
    expect(caps.json().mechanism).toBe('unsupported');
  });

  it('exposes config keys for boot presentation behavior', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/config/resolved/vestara.system.boot.presentation.profile' });
    expect(res.statusCode).toBe(200);
    expect(res.json().value).toBe('vestara-default');
  });
});
