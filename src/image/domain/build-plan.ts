import { hashOf } from '../../generator/domain/hash.js';
import type { VestaraImageProfile } from './profile.js';
import { stageOrder, type ImageBuildStage } from './lifecycle.js';

export interface BuildPlanItem {
  readonly stage: ImageBuildStage;
  readonly description: string;
  readonly generated: readonly string[];
}

export interface ImageBuildPlan {
  readonly profileId: string;
  readonly profileHash: string;
  readonly target: 'raw' | 'installer' | 'virtual';
  readonly items: readonly BuildPlanItem[];
  readonly planHash: string;
}

/**
 * IMG-003 — Build plan compiler. A profile compiles deterministically into an
 * ordered, observable plan of stages and generated artifacts. It never contains
 * arbitrary shell commands.
 */
export function compileBuildPlan(profile: VestaraImageProfile, target: 'raw' | 'installer' | 'virtual'): ImageBuildPlan {
  const items: BuildPlanItem[] = [];
  const order = stageOrder();
  const push = (stage: ImageBuildStage, description: string, generated: readonly string[] = []): void => {
    items.push({ stage, description, generated });
  };

  push('resolve-profile', `resolve image profile ${profile.id}@${profile.version}`, [profile.profileHash]);
  push('validate', `validate profile for ${profile.architecture}`, []);
  push('resolve-packages', `resolve base packages for ${profile.base.distribution}/${profile.base.release}`, profile.packages.extraPackages);
  push('bootstrap', `bootstrap ${profile.base.distribution} ${profile.base.release} rootfs`, []);
  push('install-kernel', `install kernel (${profile.base.kernel})`, []);
  push('install-runtime', 'install Vestara runtime (systemd target, API, CLIs)', ['/etc/systemd/system/vestara.target', '/etc/systemd/system/vestara-startup.service']);
  push('install-apps', `install apps: ${profile.applications.applications.join(', ')}`, profile.applications.applications);
  push('configure-systemd', 'configure systemd units + startup coordinator', ['/etc/systemd/system/vestara.target']);
  push('configure-login', 'configure login/session (vestara.desktop)', ['/usr/share/wayland-sessions/vestara.desktop', '/usr/share/xsessions/vestara.desktop']);
  push('configure-grub', `configure GRUB (timeout ${profile.boot.grub.timeout}, theme ${profile.boot.grub.theme})`, []);
  push('install-plymouth', `install Plymouth theme ${profile.boot.plymouth.theme}`, []);
  push('configure-ab', `configure A/B slots (${profile.system.abSlots})`, []);
  push('build-recovery', `build recovery environment (${profile.recovery.includes.join(', ')})`, []);
  push('configure-firstboot', `configure first-boot onboarding (${profile.onboarding.firstBoot})`, []);
  push('generate-initramfs', 'generate initramfs', []);
  push('install-bootloader', 'install bootloader (GRUB EFI)', []);
  push('sanitize', `sanitize image (noDefaultOwner=${profile.security.noDefaultOwner}, sanitizeSecrets=${profile.security.sanitizeSecrets})`, []);
  push('verify', 'static verification', []);
  push('generate-sbom', 'generate SBOM', ['sbom.json']);
  push('generate-evidence', 'generate evidence bundle', ['evidence.json']);
  push('seal', 'seal image (hashes)', []);
  push('export', `export ${target} artifact`, [`vestara-os-${profile.version}.${target === 'installer' ? 'iso' : 'img'}`]);

  void order;
  return {
    profileId: profile.id,
    profileHash: profile.profileHash,
    target,
    items,
    planHash: hashOf({ profileId: profile.id, profileHash: profile.profileHash, target, items }),
  };
}
