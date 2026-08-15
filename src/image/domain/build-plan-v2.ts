import { hashOf } from '../../generator/domain/hash.js';
import type { VestaraImageProfile, ImageBuildTarget } from './profile.js';
import type { HardwareTarget } from './hardware.js';
import type { PartitionLayout } from './partitions.js';
import type { LockedPackage } from './package-lock.js';
import { stageOrder, type ImageBuildStage } from './lifecycle.js';

export interface BuildPlanV2Item {
  readonly stage: ImageBuildStage;
  readonly description: string;
  readonly generated: readonly string[];
  readonly status: 'pending' | 'ready' | 'blocked';
}

export interface BuildPlanWarning {
  readonly message: string;
  readonly stage?: ImageBuildStage;
}

export interface BuildPlanV2Input {
  readonly profile: VestaraImageProfile;
  readonly target: ImageBuildTarget;
  readonly hardware: HardwareTarget;
  readonly partitions: PartitionLayout;
  readonly packages: readonly LockedPackage[];
}

export interface ImageBuildPlanV2 {
  readonly profileId: string;
  readonly profileHash: string;
  readonly target: ImageBuildTarget;
  readonly hardwareId: string;
  readonly hardwareName: string;
  readonly architecture: string;
  readonly items: readonly BuildPlanV2Item[];
  readonly warnings: readonly BuildPlanWarning[];
  readonly blockingErrors: readonly string[];
  readonly packageLockHash: string;
  readonly partitionOk: boolean;
  readonly estimatedSizeBytes?: number;
  readonly planHash: string;
}

/**
 * IMG-037 — BuildPlan V2. Profile + hardware target + partition layout +
 * package lock compile into an ordered, observable, per-stage plan where each
 * stage knows whether it is ready or blocked. Still never contains arbitrary
 * shell commands.
 */
export function compileBuildPlanV2(input: BuildPlanV2Input): ImageBuildPlanV2 {
  const { profile, target, hardware, partitions, packages } = input;
  const items: BuildPlanV2Item[] = [];
  const warnings: BuildPlanWarning[] = [];
  const blockingErrors: string[] = [];

  const partitionIssues = validateSimple(partitions);
  const partitionOk = partitionIssues.length === 0;

  const push = (stage: ImageBuildStage, description: string, generated: readonly string[] = [], status: BuildPlanV2Item['status'] = 'ready'): void => {
    items.push({ stage, description, generated, status });
  };

  const boot = profile.boot;

  push('resolve-profile', `resolve image profile ${profile.id}@${profile.version}`, [profile.profileHash]);
  push('validate', `validate profile for ${hardware.architecture} / ${hardware.firmware}`, []);
  push('resolve-packages', `resolve ${packages.length} locked packages`, packages.map((p) => `${p.name}@${p.version}`));

  if (!partitionOk) {
    blockingErrors.push('Partition layout is invalid — fix before building');
    push('bootstrap', 'bootstrap rootfs (blocked: invalid partition layout)', [], 'blocked');
    push('install-kernel', `install kernel (${profile.base.kernel})`, [], 'blocked');
    push('install-runtime', 'install Vestara runtime', [], 'blocked');
    push('install-apps', `install apps: ${profile.applications.applications.join(', ')}`, profile.applications.applications, 'blocked');
  } else {
    push('bootstrap', `bootstrap ${profile.base.distribution} ${profile.base.release} rootfs`, []);
    push('install-kernel', `install kernel (${profile.base.kernel})`, []);
    push('install-runtime', 'install Vestara runtime (systemd target, API, CLIs)', ['/etc/systemd/system/vestara.target']);
    push('install-apps', `install apps: ${profile.applications.applications.join(', ')}`, profile.applications.applications);
  }

  push('configure-systemd', 'configure systemd units + startup coordinator', ['/etc/systemd/system/vestara.target']);
  push('configure-login', 'configure login/session (vestara.desktop)', ['/usr/share/wayland-sessions/vestara.desktop']);
  push('configure-grub', `configure GRUB (timeout ${boot.grub.timeout}) for ${hardware.firmware}`, []);
  push('install-plymouth', `install Plymouth theme ${boot.plymouth.theme}`, []);
  push('configure-ab', `configure A/B slots (${profile.system.abSlots})`, []);
  push('build-recovery', `build recovery environment (${profile.recovery.includes.join(', ')})`, []);
  push('configure-firstboot', `configure first-boot onboarding (${profile.onboarding.firstBoot})`, []);
  push('generate-initramfs', `generate initramfs for ${hardware.architecture} (modules: ${hardware.kernelModules.join(', ')})`, []);
  push('install-bootloader', `install bootloader (${hardware.firmware.toUpperCase()}) for ${hardware.id}`, []);
  push('sanitize', `sanitize image (noDefaultOwner=${profile.security.noDefaultOwner})`, []);
  push('verify', 'static verification', []);
  push('generate-sbom', 'generate SBOM', ['sbom.spdx.json']);
  push('generate-evidence', 'generate evidence bundle', ['evidence/']);
  push('seal', 'seal image (hashes)', []);
  push('export', `export ${target} artifact`, [`vestara-os-${profile.version}.${target === 'installer' ? 'iso' : 'img'}`]);

  for (const moduleName of hardware.kernelModules) {
    if (moduleName.length === 0) continue;
  }

  const estimatedSizeBytes = estimateImageSize({ partitions, packages, profile });

  return {
    profileId: profile.id,
    profileHash: profile.profileHash,
    target,
    hardwareId: hardware.id,
    hardwareName: hardware.name,
    architecture: hardware.architecture,
    items,
    warnings,
    blockingErrors,
    packageLockHash: hashOf(packages.map((p) => p.hash).join('|')),
    partitionOk,
    ...(estimatedSizeBytes !== undefined ? { estimatedSizeBytes } : {}),
    planHash: hashOf({
      profileId: profile.id,
      profileHash: profile.profileHash,
      target,
      hardwareId: hardware.id,
      partitions,
      packages: packages.map((p) => p.hash),
    }),
  };
}

function validateSimple(layout: PartitionLayout): readonly string[] {
  const issues: string[] = [];
  const total = layout.partitions.reduce((sum, p) => sum + p.sizeBytes, 0);
  if (total > layout.diskSizeBytes) issues.push('Partitions exceed disk size');
  if (layout.tableType === 'gpt' && !layout.partitions.some((p) => p.kind === 'efi')) {
    issues.push('GPT layout requires an EFI partition');
  }
  return issues;
}

function estimateImageSize(input: { partitions: PartitionLayout; packages: readonly LockedPackage[]; profile: VestaraImageProfile }): number {
  const { partitions, packages } = input;
  const partitionTotal = partitions.partitions.reduce((sum, p) => sum + p.sizeBytes, 0);
  const packageBytes = packages.reduce((sum, p) => sum + Math.max(p.name.length * 4, 16) * 1024 * 1024, 0);
  return Math.min(partitionTotal, packageBytes);
}

void stageOrder;
