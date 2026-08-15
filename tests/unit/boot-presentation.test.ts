import { describe, expect, it } from 'vitest';
import { BootPresentationService } from '../../src/system/boot-presentation/service/boot-presentation-service.js';
import { InMemoryBootAssetStore } from '../../src/system/boot-presentation/domain/asset.js';
import { UnsupportedFirmwareLogoAdapter } from '../../src/system/boot-presentation/adapters/firmware-logo.js';

function buildService(threshold = 2) {
  const assetStore = new InMemoryBootAssetStore();
  const service = new BootPresentationService({ assetStore, firmwareLogo: new UnsupportedFirmwareLogoAdapter(), bootAttemptThreshold: threshold });
  return { service, assetStore };
}

describe('BootPresentationService (SYS-020/021)', () => {
  it('previews a profile without applying', async () => {
    const { service } = buildService();
    await service.saveProfile({ id: 'p1', version: 1, name: 'Vestara Dark', grub: { theme: undefined } as never });
    const profile = (await service.getProfile('p1'))!;
    const preview = await service.preview(profile.id);
    expect(preview.changes.length).toBeGreaterThan(0);
    expect(preview.requiresReboot).toBe(false); // grub-only
  });

  it('rejects apply without approval', async () => {
    const { service } = buildService();
    await service.saveProfile({ id: 'p1', version: 1, name: 'Vestara' });
    const profile = (await service.getProfile('p1'))!;
    await expect(service.apply(profile.id, false)).rejects.toThrow(/approval/i);
  });

  it('applies a plymouth profile and enters pending-reboot-verification', async () => {
    const { service, assetStore } = buildService();
    const asset = await assetStore.store({ name: 'logo.png', bytes: new Uint8Array([1]) });
    await service.saveProfile({
      id: 'p1',
      version: 1,
      name: 'Vestara',
      plymouth: { logo: { assetId: asset.assetId, sha256: asset.sha256, mediaType: 'image/png' }, progressStyle: 'dots' },
    });
    const profile = (await service.getProfile('p1'))!;
    const preview = await service.apply(profile.id, true);
    expect(preview.requiresReboot).toBe(true);
    expect(service.getState().status).toBe('pending-reboot-verification');
    expect(service.getState().pendingVerificationProfileId).toBe('p1');
  });

  it('verifies after successful boot', async () => {
    const { service, assetStore } = buildService();
    const asset = await assetStore.store({ name: 'logo.png', bytes: new Uint8Array([1]) });
    await service.saveProfile({ id: 'p1', version: 1, name: 'Vestara', plymouth: { logo: { assetId: asset.assetId, sha256: asset.sha256, mediaType: 'image/png' } } });
    const profile = (await service.getProfile('p1'))!;
    await service.apply(profile.id, true);
    await service.recordBootResult(true);
    expect(service.getState().status).toBe('verified');
  });

  it('increments bootAttempts on failed boot and restores known-good at threshold', async () => {
    const { service, assetStore } = buildService(2);
    const asset = await assetStore.store({ name: 'logo.png', bytes: new Uint8Array([1]) });
    await service.saveProfile({ id: 'p1', version: 1, name: 'Vestara', plymouth: { logo: { assetId: asset.assetId, sha256: asset.sha256, mediaType: 'image/png' } } });
    const profile = (await service.getProfile('p1'))!;
    await service.apply(profile.id, true);

    await service.recordBootResult(false);
    expect(service.getState().bootAttempts).toBe(1);
    expect(service.getState().status).toBe('pending-reboot-verification');

    await service.recordBootResult(false);
    expect(service.getState().status).toBe('failed');
  });

  it('rolls back explicitly', async () => {
    const { service, assetStore } = buildService();
    const asset = await assetStore.store({ name: 'logo.png', bytes: new Uint8Array([1]) });
    await service.saveProfile({ id: 'p1', version: 1, name: 'Vestara', plymouth: { logo: { assetId: asset.assetId, sha256: asset.sha256, mediaType: 'image/png' } } });
    const profile = (await service.getProfile('p1'))!;
    await service.apply(profile.id, true);
    await service.rollback();
    expect(service.getState().status).toBe('none');
  });
});

describe('firmware-logo gates (SYS-023)', () => {
  it('rejects firmware-logo preview on unsupported hardware', async () => {
    const { service, assetStore } = buildService();
    const asset = await assetStore.store({ name: 'logo.png', bytes: new Uint8Array([1]) });
    await expect(service.firmareLogoPreview(asset.assetId)).rejects.toThrow();
  });

  it('rejects firmware-logo apply without special-policy approval', async () => {
    const { service, assetStore } = buildService();
    const asset = await assetStore.store({ name: 'logo.png', bytes: new Uint8Array([1]) });
    await expect(service.applyFirmwareLogo(asset.assetId, false)).rejects.toThrow(/special-policy/i);
  });

  it('restore is unsupported on unsupported hardware', async () => {
    const { service } = buildService();
    await expect(service.restoreFirmwareLogo()).rejects.toThrow();
  });
});
