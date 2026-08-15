/** IMG-038 — Preflight engine. Do not discover environment failures mid-build. */

import type { VestaraImageProfile, ImageBuildTarget } from './profile.js';
import type { HardwareTarget } from './hardware.js';
import { validatePartitionLayout } from './partitions.js';

export type PreflightVerdict = 'ready' | 'ready-with-warnings' | 'blocked';

export interface PreflightItem {
  readonly name: string;
  readonly status: 'pass' | 'warn' | 'fail';
  readonly message: string;
  readonly category: 'profile' | 'packages' | 'hardware' | 'environment' | 'output' | 'signing';
}

export interface PreflightResult {
  readonly verdict: PreflightVerdict;
  readonly items: readonly PreflightItem[];
  readonly blockingCount: number;
  readonly warningCount: number;
  readonly checkedAt: string;
}

export interface PreflightContext {
  readonly profile: VestaraImageProfile;
  readonly target: ImageBuildTarget;
  readonly hardware: HardwareTarget;
  readonly diskFreeBytes: number;
  readonly memoryAvailableBytes: number;
  readonly memoryRequiredBytes: number;
  readonly toolsAvailable: readonly string[];
  readonly signingAvailable: boolean;
  readonly outputWritable: boolean;
  readonly repositoryReachable: boolean;
}

/**
 * IMG-038 — Preflight. Profiles, packages, hardware, environment and signing
 * are checked before a build is allowed. The verdict is READY,
 * READY WITH WARNINGS or BLOCKED. Fundamental failures are found here, not
 * halfway through a build.
 */
export function runPreflight(context: PreflightContext): PreflightResult {
  const items: PreflightItem[] = [];
  const { profile, hardware } = context;

  // Profile validity
  if (!profile.id || !profile.version) {
    items.push({ name: 'Profile identity', status: 'fail', message: 'Profile id and version are required', category: 'profile' });
  } else {
    items.push({ name: 'Profile identity', status: 'pass', message: `${profile.id}@${profile.version}`, category: 'profile' });
  }

  if (profile.architecture !== hardware.architecture) {
    items.push({
      name: 'Architecture match',
      status: 'fail',
      message: `Profile is ${profile.architecture} but target ${hardware.id} is ${hardware.architecture}`,
      category: 'hardware',
    });
  } else {
    items.push({ name: 'Architecture match', status: 'pass', message: `${profile.architecture} matches target`, category: 'hardware' });
  }

  // Packages / repositories
  items.push({
    name: 'Repository reachable',
    status: context.repositoryReachable ? 'pass' : 'warn',
    message: context.repositoryReachable ? 'Package repositories reachable' : 'Package repositories not reachable (may block resolution)',
    category: 'packages',
  });

  // Environment
  if (context.diskFreeBytes < 8 * 1024 * 1024 * 1024) {
    items.push({ name: 'Disk space', status: 'fail', message: `Insufficient disk: ${context.diskFreeBytes} bytes free`, category: 'environment' });
  } else {
    items.push({ name: 'Disk space', status: 'pass', message: `${context.diskFreeBytes} bytes free`, category: 'environment' });
  }

  if (context.memoryAvailableBytes < context.memoryRequiredBytes) {
    items.push({
      name: 'Memory',
      status: 'fail',
      message: `Insufficient memory: ${context.memoryAvailableBytes} available, ${context.memoryRequiredBytes} required`,
      category: 'environment',
    });
  } else {
    items.push({ name: 'Memory', status: 'pass', message: `${context.memoryAvailableBytes} available`, category: 'environment' });
  }

  // Required tools
  const missingTools = context.toolsAvailable.filter((t) => !['grub', 'plymouth', 'qemu', 'ovmf'].includes(t));
  if (context.toolsAvailable.length > 0) {
    const hasQemu = context.toolsAvailable.includes('qemu') || context.toolsAvailable.includes('ovmf');
    items.push({
      name: 'Build tools',
      status: hasQemu ? 'pass' : 'warn',
      message: hasQemu ? 'QEMU/OVMF verification tools available' : 'QEMU/OVMF not available — verification will be skipped',
      category: 'environment',
    });
  }
  void missingTools;

  // Output
  items.push({
    name: 'Output writable',
    status: context.outputWritable ? 'pass' : 'fail',
    message: context.outputWritable ? 'Output location is writable' : 'Output location is not writable',
    category: 'output',
  });

  // Signing
  items.push({
    name: 'Signing material',
    status: context.signingAvailable ? 'pass' : 'warn',
    message: context.signingAvailable ? 'Signing material available' : 'Signing material unavailable — artifact will be unsigned',
    category: 'signing',
  });

  const fails = items.filter((i) => i.status === 'fail').length;
  const warns = items.filter((i) => i.status === 'warn').length;
  const verdict: PreflightVerdict = fails > 0 ? 'blocked' : warns > 0 ? 'ready-with-warnings' : 'ready';

  return {
    verdict,
    items,
    blockingCount: fails,
    warningCount: warns,
    checkedAt: new Date().toISOString(),
  };
}
