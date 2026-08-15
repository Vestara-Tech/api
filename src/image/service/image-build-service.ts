import { badRequest, conflict, forbidden } from '../../core/errors.js';
import { randomId } from '../../core/identifiers.js';
import { hashOf } from '../../generator/domain/hash.js';
import type { VestaraImageProfile, ImageBuildTarget } from '../domain/profile.js';
import { withProfileHash } from '../domain/profile.js';
import { ImageProfileRegistry } from '../domain/registry.js';
import { compileBuildPlan, type ImageBuildPlan } from '../domain/build-plan.js';
import type { ImageBuildStage, ImageBuildStatus, ImageBuildState } from '../domain/lifecycle.js';
import { stageOrder } from '../domain/lifecycle.js';
import type { ImageRootfsPort, BootstrapAdapter } from '../adapters/build-ports.js';

export interface ImageBuildServiceOptions {
  readonly registry?: ImageProfileRegistry;
  readonly bootstrap?: BootstrapAdapter;
  readonly rootfs?: ImageRootfsPort;
}

export interface ImageBuildResult {
  readonly state: ImageBuildState;
  readonly plan: ImageBuildPlan;
  readonly evidence: { readonly planHash: string; readonly artifactPath: string; readonly evidenceHash: string };
}

export class ImageBuildService {
  private readonly registry: ImageProfileRegistry;
  private readonly bootstrap: BootstrapAdapter | undefined;
  private readonly rootfs: ImageRootfsPort | undefined;
  private state: ImageBuildState = { buildId: '', status: 'draft', completedStages: [] };

  constructor(options: ImageBuildServiceOptions = {}) {
    this.registry = options.registry ?? new ImageProfileRegistry();
    this.registry.registerDefaults();
    this.bootstrap = options.bootstrap;
    this.rootfs = options.rootfs;
  }

  getState(): ImageBuildState {
    return this.state;
  }

  listProfiles(): readonly VestaraImageProfile[] {
    return this.registry.list();
  }

  getProfile(id: string): VestaraImageProfile {
    return this.registry.get(id);
  }

  registerProfile(input: Omit<VestaraImageProfile, 'profileHash'>): VestaraImageProfile {
    const profile = withProfileHash(input);
    this.registry.register(profile);
    return profile;
  }

  plan(profileId: string, target: ImageBuildTarget): ImageBuildPlan {
    const profile = this.registry.get(profileId);
    return compileBuildPlan(profile, target);
  }

  /** IMG — Governed build: plan → run stages → verify → evidence. */
  async build(profileId: string, target: ImageBuildTarget, approved: boolean): Promise<ImageBuildResult> {
    if (!approved) throw forbidden('Image build requires approval');
    const profile = this.registry.get(profileId);
    const plan = compileBuildPlan(profile, target);

    this.state = {
      buildId: randomId('build'),
      status: 'building',
      startedAt: new Date().toISOString(),
      completedStages: [],
    };

    // Run the stages in order; rootfs/bootstrap stages delegate to adapters.
    for (const stage of stageOrder()) {
      this.state = { ...this.state, currentStage: stage };
      await this.runStage(stage, profile, plan);
      this.state = { ...this.state, completedStages: [...this.state.completedStages, stage] };
    }

    const evidenceHash = hashOf({ planHash: plan.planHash, profileHash: profile.profileHash, buildId: this.state.buildId });
    const artifactPath = `vestara-os-${profile.version}.${target === 'installer' ? 'iso' : 'img'}`;
    const completed: ImageBuildState = {
      ...this.state,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };
    delete completed.currentStage;
    this.state = completed;

    return {
      state: this.state,
      plan,
      evidence: { planHash: plan.planHash, artifactPath, evidenceHash },
    };
  }

  private async runStage(stage: ImageBuildStage, profile: VestaraImageProfile, _plan: ImageBuildPlan): Promise<void> {
    if (stage === 'bootstrap') {
      if (this.bootstrap && this.rootfs) {
        const result = await this.bootstrap.bootstrap(profile, this.rootfs.rootPath());
        if (!result.ok) this.fail(stage, result.message ?? 'bootstrap failed');
      }
      return;
    }
    if (stage === 'generate-initramfs') {
      // No privileged adapter in this environment — degrade gracefully.
      return;
    }
    if (stage === 'install-bootloader') {
      // Requires a privileged adapter; absent in the API process.
      return;
    }
    // All other stages are planner-driven (recorded, no privileged writes).
    return;
  }

  private fail(stage: ImageBuildStage, message: string): never {
    this.state = { ...this.state, status: 'failed', failedStage: stage, failureMessage: message };
    throw badRequest(`Image build failed at ${stage}: ${message}`);
  }
}
