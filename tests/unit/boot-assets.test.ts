import { describe, expect, it } from 'vitest';
import { InMemoryBootAssetStore, assertSafeAssetName, validateAsset, toRef } from '../../src/system/boot-presentation/domain/asset.js';
import { createBootPresentationProfile } from '../../src/system/boot-presentation/domain/profile.js';
import { UnsupportedFirmwareLogoAdapter, requiresSpecialPolicy } from '../../src/system/boot-presentation/adapters/firmware-logo.js';

describe('boot asset store (SYS-016/017)', () => {
  it('rejects raw filesystem paths from clients', () => {
    expect(() => assertSafeAssetName('logo.png')).not.toThrow();
    expect(() => assertSafeAssetName('../../etc/shadow')).toThrow();
    expect(() => assertSafeAssetName('/root/image.png')).toThrow();
    expect(() => assertSafeAssetName('file:///etc/passwd')).toThrow();
  });

  it('stores assets content-addressed by sha256', async () => {
    const store = new InMemoryBootAssetStore();
    const asset = await store.store({ name: 'vestara.png', bytes: new TextEncoder().encode('logo-bytes') });
    expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/);
    const dup = await store.store({ name: 'vestara-copy.png', bytes: new TextEncoder().encode('logo-bytes') });
    expect(dup.assetId).toBe(asset.assetId); // deduped
    expect(store.get(asset.assetId)).resolves.toBeDefined();
  });

  it('validates assets by media type and target', async () => {
    const store = new InMemoryBootAssetStore();
    const png = await store.store({ name: 'logo.png', bytes: new Uint8Array([1, 2, 3]) });
    expect(validateAsset(png, 'plymouth').ok).toBe(true);
    const bad = await store.store({ name: 'logo.txt', bytes: new Uint8Array([1]), mediaType: 'text/plain' });
    expect(validateAsset(bad, 'firmware').ok).toBe(false); // firmware requires PNG
  });

  it('produces a BootAssetRef without bytes', async () => {
    const store = new InMemoryBootAssetStore();
    const asset = await store.store({ name: 'logo.png', bytes: new Uint8Array([1]) });
    const ref = toRef(asset);
    expect(ref.assetId).toBe(asset.assetId);
    expect('bytes' in ref).toBe(false);
  });
});

describe('boot presentation profile (SYS-015)', () => {
  it('computes a deterministic profile hash', () => {
    const profile = createBootPresentationProfile({ id: 'p1', version: 1, name: 'Vestara Dark', plymouth: { progressStyle: 'dots' } });
    const same = createBootPresentationProfile({ id: 'p1', version: 1, name: 'Vestara Dark', plymouth: { progressStyle: 'dots' } });
    const different = createBootPresentationProfile({ id: 'p1', version: 1, name: 'Vestara Light', plymouth: { progressStyle: 'minimal' } });
    expect(profile.profileHash).toBe(same.profileHash);
    expect(profile.profileHash).not.toBe(different.profileHash);
    expect(profile.profileHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('firmware-logo capability discovery (SYS-022/023)', () => {
  it('unsupported adapter reports unsupported, never flashing', async () => {
    const adapter = new UnsupportedFirmwareLogoAdapter();
    const caps = await adapter.discover();
    expect(caps.replaceable).toBe(false);
    expect(caps.mechanism).toBe('unsupported');
    expect(requiresSpecialPolicy(caps)).toBe(false);
    expect((await adapter.apply({ assetId: 'x', sha256: 'y', mediaType: 'image/png' })).ok).toBe(false);
  });
});
