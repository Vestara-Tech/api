import { ImageBuildService } from '../image/service/image-build-service.js';
import type { BootstrapAdapter, BootstrapResult } from '../image/adapters/build-ports.js';
import type { VestaraImageProfile } from '../image/domain/profile.js';

/** Dev bootstrap adapter: reports unavailable honestly (no debootstrap in the API process). */
class DevBootstrapAdapter implements BootstrapAdapter {
  async bootstrap(_profile: VestaraImageProfile, rootfs: string): Promise<BootstrapResult> {
    return { ok: false, rootfs, message: 'no privileged bootstrap access in this environment' };
  }
}

export function buildImageBuilderService(): ImageBuildService {
  return new ImageBuildService({ bootstrap: new DevBootstrapAdapter() });
}
