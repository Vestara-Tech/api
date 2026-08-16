import type { PackageChannel } from './versioning.js';

export type UpdatePolicy = 'auto' | 'prompt' | 'manual' | 'hold';

export type UpdateAction = 'apply' | 'prompt' | 'hold' | 'none';

export interface UpdatePolicyConfig {
  readonly packageId: string;
  readonly policy: UpdatePolicy;
  /** Channel whose latest version the policy applies to. */
  readonly channel: PackageChannel;
  /** Block major version bumps under auto/prompt policies. */
  readonly blockMajor?: boolean;
}

export interface UpdateEvaluation {
  readonly packageId: string;
  readonly currentVersion: string;
  readonly latestVersion: string;
  readonly channel: PackageChannel;
  readonly updateAvailable: boolean;
  readonly breaking: boolean;
  readonly policy: UpdatePolicy;
  readonly action: UpdateAction;
  readonly reason: string;
}

/** True when a major version boundary (0.x -> 1.x, or x.y -> (x+1).0) is crossed. */
export function isMajorBump(from: string, to: string): boolean {
  const majorOf = (v: string): number => Number.parseInt(v.split('.')[0] ?? '0', 10) || 0;
  return majorOf(to) > majorOf(from);
}

/**
 * MKT2-019 — Update policies. auto applies the latest compatible release;
 * prompt asks before installing; manual requires an explicit action; hold
 * never auto-advances. Major bumps are gated under auto/prompt unless allowed.
 */
export class UpdatePolicyEngine {
  private readonly configs = new Map<string, UpdatePolicyConfig>();

  set(config: UpdatePolicyConfig): void {
    this.configs.set(config.packageId, config);
  }

  policyFor(packageId: string): UpdatePolicyConfig | undefined {
    return this.configs.get(packageId);
  }

  evaluate(currentVersion: string, latestVersion: string, channel: PackageChannel, policy: UpdatePolicyConfig): UpdateEvaluation {
    if (latestVersion === currentVersion) {
      return { packageId: policy.packageId, currentVersion, latestVersion, channel, updateAvailable: false, breaking: false, policy: policy.policy, action: 'none', reason: 'already on latest' };
    }
    const breaking = isMajorBump(currentVersion, latestVersion);
    if (policy.policy === 'hold') {
      return { packageId: policy.packageId, currentVersion, latestVersion, channel, updateAvailable: true, breaking, policy: 'hold', action: 'hold', reason: 'update policy is hold' };
    }
    if (breaking && policy.blockMajor) {
      return { packageId: policy.packageId, currentVersion, latestVersion, channel, updateAvailable: true, breaking, policy: policy.policy, action: 'hold', reason: `major bump to ${latestVersion} blocked by policy` };
    }
    if (policy.policy === 'manual') {
      return { packageId: policy.packageId, currentVersion, latestVersion, channel, updateAvailable: true, breaking, policy: 'manual', action: 'prompt', reason: 'manual update policy requires explicit action' };
    }
    if (policy.policy === 'prompt') {
      return { packageId: policy.packageId, currentVersion, latestVersion, channel, updateAvailable: true, breaking, policy: 'prompt', action: 'prompt', reason: breaking ? `major bump available (${latestVersion})` : `update available (${latestVersion})` };
    }
    return { packageId: policy.packageId, currentVersion, latestVersion, channel, updateAvailable: true, breaking, policy: 'auto', action: 'apply', reason: breaking ? `auto-applying major bump (${latestVersion})` : `auto-applying update (${latestVersion})` };
  }
}
