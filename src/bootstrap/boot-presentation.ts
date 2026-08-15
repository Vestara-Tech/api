import { BootPresentationService } from '../system/boot-presentation/service/boot-presentation-service.js';
import { InMemoryBootAssetStore } from '../system/boot-presentation/domain/asset.js';
import { UnsupportedFirmwareLogoAdapter } from '../system/boot-presentation/adapters/firmware-logo.js';

/**
 * Builds the boot presentation service. In a dev environment no privileged
 * adapters are available, so Plymouth/GRUB apply is a no-op and firmware-logo
 * reports unsupported — the governed pipeline is still exercised end-to-end.
 */
export function buildBootPresentationService(): BootPresentationService {
  return new BootPresentationService({
    assetStore: new InMemoryBootAssetStore(),
    firmwareLogo: new UnsupportedFirmwareLogoAdapter(),
  });
}
