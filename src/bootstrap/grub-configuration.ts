import { GrubConfigurationService } from '../system/grub/service/grub-configuration-service.js';
import { InMemoryBootAssetStore } from '../system/boot-presentation/domain/asset.js';
import type { GrubAdapter } from '../system/grub/adapters/grub-adapter.js';
import type { GrubConfiguration } from '../system/grub/domain/configuration.js';
import type { BootEntry } from '../system/domain/boot.js';

/**
 * A no-op GRUB adapter for the dev environment: GRUB is reported unavailable so
 * the governed pipeline degrades honestly without touching the host bootloader.
 */
class DevGrubAdapter implements GrubAdapter {
  async discover() {
    return { available: false, reason: 'no privileged GRUB access in this environment' };
  }
  async read(): Promise<GrubConfiguration | null> {
    return null;
  }
  async backup() {
    return { ok: false, message: 'unavailable' };
  }
  async apply() {
    return { ok: false, message: 'unavailable' };
  }
  async regenerate() {
    return { ok: false, message: 'unavailable' };
  }
  async verify() {
    return { ok: false, message: 'unavailable' };
  }
  async rollback() {
    return { ok: true, message: 'no-op' };
  }
  async setDefault() {
    return { ok: false, message: 'unavailable' };
  }
  async setNext() {
    return { ok: false, message: 'unavailable' };
  }
  async listEntries(): Promise<readonly BootEntry[]> {
    return [];
  }
  async applyTheme() {
    return { ok: false, message: 'unavailable' };
  }
}

export function buildGrubConfigurationService(): GrubConfigurationService {
  return new GrubConfigurationService({
    adapter: new DevGrubAdapter(),
    assetStore: new InMemoryBootAssetStore(),
  });
}
