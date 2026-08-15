import { ImageBuildService } from '../image/service/image-build-service.js';
import { ImagePlatformV2 } from '../image/service/image-platform-v2.js';
import { ImageExecutionPipeline } from '../image/service/image-execution-pipeline.js';
import { resolveHardwareTarget } from '../image/domain/hardware.js';
import type { BootstrapAdapter, BootstrapResult } from '../image/adapters/build-ports.js';
import type { VestaraImageProfile } from '../image/domain/profile.js';
import type { EventBus } from '../core/events.js';

/** Dev bootstrap adapter: reports unavailable honestly (no debootstrap in the API process). */
class DevBootstrapAdapter implements BootstrapAdapter {
  async bootstrap(_profile: VestaraImageProfile, rootfs: string): Promise<BootstrapResult> {
    return { ok: false, rootfs, message: 'no privileged bootstrap access in this environment' };
  }
}

export interface ImageBuilderPlatform {
  readonly service: ImageBuildService;
  readonly platformV2: ImagePlatformV2;
  readonly execution: ImageExecutionPipeline;
}

export function buildImageBuilderService(events?: EventBus): ImageBuilderPlatform {
  const service = new ImageBuildService({ bootstrap: new DevBootstrapAdapter() });
  const platformV2 = new ImagePlatformV2({
    getProfile: (id) => service.getProfile(id),
    eventPublisher: (type, payload) => {
      if (!events) return;
      events.publish({ type, category: 'domain', occurredAt: new Date().toISOString(), payload });
    },
  });
  const execution = new ImageExecutionPipeline({
    getProfile: (id) => service.getProfile(id),
    getHardware: resolveHardwareTarget,
    qemuAvailable: false,
    ovmfAvailable: false,
  });
  return { service, platformV2, execution };
}
