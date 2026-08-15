import type { VestaraImageProfile } from '../domain/profile.js';
import type { HardwareTarget } from '../domain/hardware.js';
import { hardwareTargetCatalog, resolveHardwareTarget } from '../domain/hardware.js';
import type { PartitionLayout } from '../domain/partitions.js';
import { validatePartitionLayout, defaultDesktopLayout } from '../domain/partitions.js';
import type { ImageProfileLifecycle, ImageProfileTransition } from '../domain/lifecycle-profile.js';
import { advanceLifecycle, initialLifecycle, canTransition } from '../domain/lifecycle-profile.js';
import type { LockedPackage, PackageResolutionResult } from '../domain/package-lock.js';
import { resolvePackages } from '../domain/package-lock.js';
import type { ImageBuildPlanV2 } from '../domain/build-plan-v2.js';
import { compileBuildPlanV2 } from '../domain/build-plan-v2.js';
import type { PreflightResult, PreflightContext } from '../domain/preflight.js';
import { runPreflight } from '../domain/preflight.js';
import type { BuildRun } from '../domain/build-run.js';
import { BuildRunController } from '../domain/build-run.js';
import type { ImageBuildTarget, VestaraImageProfile as Profile } from '../domain/profile.js';

export interface ImagePlatformV2Options {
  readonly getProfile: (id: string) => VestaraImageProfile;
  readonly eventPublisher?: (type: string, payload: Readonly<Record<string, unknown>>) => void;
}

/**
 * IMG-031..041 — Image Platform V2 orchestration. Profile lifecycle, hardware
 * targets, partition layouts, package locks, BuildPlan V2, preflight and
 * resumable build runs compose above the base ImageBuildService. Each
 * transition publishes a typed build event.
 */
export class ImagePlatformV2 {
  private readonly lifecycles = new Map<string, ImageProfileLifecycle>();
  private readonly getProfile: (id: string) => VestaraImageProfile;
  private readonly runController: BuildRunController;
  private readonly eventPublisher: (type: string, payload: Readonly<Record<string, unknown>>) => void;

  constructor(options: ImagePlatformV2Options) {
    this.getProfile = options.getProfile;
    this.eventPublisher = options.eventPublisher ?? (() => undefined);
    this.runController = new BuildRunController();
  }

  hardwareTargets(): readonly HardwareTarget[] {
    return hardwareTargetCatalog();
  }

  partitionLayout(profileId: string, diskSizeBytes?: number): PartitionLayout {
    const profile = this.getProfile(profileId);
    void profile;
    return defaultDesktopLayout(diskSizeBytes);
  }

  validatePartitions(layout: PartitionLayout) {
    return validatePartitionLayout(layout);
  }

  lifecycle(profileId: string): ImageProfileLifecycle {
    let lifecycle = this.lifecycles.get(profileId);
    if (!lifecycle) {
      lifecycle = initialLifecycle(profileId);
      this.lifecycles.set(profileId, lifecycle);
    }
    return lifecycle;
  }

  transition(profileId: string, transition: ImageProfileTransition): ImageProfileLifecycle {
    const current = this.lifecycle(profileId);
    if (!canTransition(current.status, transition)) {
      throw new Error(`Invalid transition "${transition}" from "${current.status}"`);
    }
    const next = advanceLifecycle(current, transition);
    this.lifecycles.set(profileId, next);
    this.eventPublisher(`image.profile.${transition}`, { profileId, from: current.status, to: next.status, revision: next.currentRevision });
    return next;
  }

  resolvePackagesForProfile(profileId: string): PackageResolutionResult {
    const profile = this.getProfile(profileId);
    return resolvePackages({
      base: profile.base.distribution === 'debian' ? ['base-system'] : [],
      extra: profile.packages.extraPackages,
    });
  }

  planV2(profileId: string, target: ImageBuildTarget, hardwareId: string): ImageBuildPlanV2 {
    const profile = this.getProfile(profileId);
    const hardware = resolveHardwareTarget(hardwareId);
    const layout = defaultDesktopLayout();
    const packages = this.resolvePackagesForProfile(profileId).locked;
    return compileBuildPlanV2({ profile, target, hardware, partitions: layout, packages });
  }

  preflight(options: { profileId: string; target: ImageBuildTarget; hardwareId: string; env?: Partial<PreflightContext> }): PreflightResult {
    const profile = this.getProfile(options.profileId);
    const hardware = resolveHardwareTarget(options.hardwareId);
    const context: PreflightContext = {
      profile,
      target: options.target,
      hardware,
      diskFreeBytes: options.env?.diskFreeBytes ?? 100 * 1024 * 1024 * 1024,
      memoryAvailableBytes: options.env?.memoryAvailableBytes ?? 8 * 1024 * 1024 * 1024,
      memoryRequiredBytes: options.env?.memoryRequiredBytes ?? 2 * 1024 * 1024 * 1024,
      toolsAvailable: options.env?.toolsAvailable ?? ['grub', 'plymouth', 'qemu', 'ovmf'],
      signingAvailable: options.env?.signingAvailable ?? true,
      outputWritable: options.env?.outputWritable ?? true,
      repositoryReachable: options.env?.repositoryReachable ?? true,
    };
    return runPreflight(context);
  }

  createRun(profileId: string, target: ImageBuildTarget): BuildRun {
    const created = this.runController.create({ profileId, target });
    const run = this.runController.start(created.id);
    this.eventPublisher('image.build.started', { runId: run.id, profileId, target });
    return run;
  }

  resumeRun(profileId: string, target: ImageBuildTarget, runId?: string): BuildRun {
    let resumeFrom;
    if (runId) {
      const existing = this.runController.get(runId);
      if (existing.status !== 'failed' && existing.status !== 'cancelled') {
        throw new Error(`Build run "${runId}" is not resumable (status ${existing.status})`);
      }
      const lastCompleted = [...existing.stages].reverse().find((s) => s.status === 'completed');
      resumeFrom = lastCompleted?.stage;
    }
    const created = this.runController.create({ profileId, target, ...(resumeFrom ? { resumedFromStage: resumeFrom } : {}) });
    const run = this.runController.start(created.id);
    this.eventPublisher('image.build.resumed', { runId: run.id, profileId, target, resumedFromStage: resumeFrom });
    return run;
  }

  runs(): readonly BuildRun[] {
    return this.runController.list();
  }

  run(id: string): BuildRun {
    return this.runController.get(id);
  }
}

export type { Profile };
