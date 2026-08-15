import { describe, expect, it } from 'vitest';
import {
  advanceLifecycle,
  canTransition,
  compileBuildPlanV2,
  defaultDesktopLayout,
  initialLifecycle,
  nextStatus,
  resolvePackages,
  resolveHardwareTarget,
  runPreflight,
  validatePartitionLayout,
  BuildRunController,
  hardwareTargetCatalog,
  DESKTOP_PROFILE,
} from '../../src/image/index.js';

describe('IMG-033 hardware targets', () => {
  it('catalogs hardware targets and resolves by id', () => {
    const targets = hardwareTargetCatalog();
    expect(targets.some((t) => t.id === 'virtual-machine')).toBe(true);
    expect(targets.some((t) => t.id === 'raspberry-pi-4')).toBe(true);
    const vm = resolveHardwareTarget('virtual-machine');
    expect(vm.firmware).toBe('uefi');
    expect(vm.architecture).toBe('amd64');
  });
});

describe('IMG-034 partition designer', () => {
  it('validates the default desktop layout as ok', () => {
    const layout = defaultDesktopLayout();
    const result = validatePartitionLayout(layout);
    expect(result.ok).toBe(true);
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('rejects layouts that exceed disk size', () => {
    const layout: typeof defaultDesktopLayout extends never ? never : ReturnType<typeof defaultDesktopLayout> = {
      tableType: 'gpt',
      diskSizeBytes: 100 * 1024 * 1024 * 1024,
      partitions: [
        { name: 'EFI', kind: 'efi', sizeBytes: 1024 * 1024 * 1024, filesystem: 'fat32' },
        { name: 'Root', kind: 'root', sizeBytes: 150 * 1024 * 1024 * 1024, filesystem: 'ext4' },
      ],
    };
    const result = validatePartitionLayout(layout);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('exceeds disk size'))).toBe(true);
  });

  it('rejects GPT layouts without an EFI partition', () => {
    const layout = { ...defaultDesktopLayout(), partitions: defaultDesktopLayout().partitions.filter((p) => p.kind !== 'efi') };
    const result = validatePartitionLayout(layout);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('EFI system partition'))).toBe(true);
  });
});

describe('IMG-031 profile lifecycle', () => {
  it('moves draft -> validating -> ready -> building -> verified -> published', () => {
    const lifecycle = initialLifecycle('p1');
    expect(canTransition(lifecycle.status, 'validate')).toBe(true);
    const validating = advanceLifecycle(lifecycle, 'validate');
    expect(validating.status).toBe('validating');
    const ready = advanceLifecycle(validating, 'approve');
    expect(ready.status).toBe('ready');
    const building = advanceLifecycle(ready, 'start-build');
    expect(building.status).toBe('building');
    const verified = advanceLifecycle(building, 'verify');
    expect(verified.status).toBe('verified');
    const published = advanceLifecycle(verified, 'publish');
    expect(published.status).toBe('published');
    expect(published.publishedAt).toBeTruthy();
    expect(published.currentRevision).toBeGreaterThanOrEqual(2);
  });

  it('rejects invalid transitions', () => {
    const lifecycle = initialLifecycle('p2');
    expect(() => advanceLifecycle(lifecycle, 'publish')).toThrow(/Invalid transition/);
    expect(nextStatus('draft', 'validate')).toBe('validating');
  });

  it('deprecates published profiles and reopens drafts', () => {
    const published = advanceLifecycle(advanceLifecycle(advanceLifecycle(advanceLifecycle(advanceLifecycle(initialLifecycle('p3'), 'validate'), 'approve'), 'start-build'), 'verify'), 'publish');
    expect(advanceLifecycle(published, 'deprecate').status).toBe('deprecated');
    const validating = advanceLifecycle(initialLifecycle('p4'), 'validate');
    expect(advanceLifecycle(validating, 'reopen').status).toBe('draft');
  });
});

describe('IMG-036 package lock', () => {
  it('locks packages deterministically and deduplicates', () => {
    const result = resolvePackages({ base: ['base-system'], extra: ['curl', 'curl'] });
    expect(result.locked.map((p) => p.name).sort()).toEqual(['base-system', 'curl']);
    expect(result.lockHash).toBeTruthy();
    expect(result.warnings.some((w) => w.includes('Duplicate'))).toBe(true);

    const again = resolvePackages({ base: ['base-system'], extra: ['curl'] });
    expect(again.lockHash).toBe(result.lockHash);
  });
});

describe('IMG-037 BuildPlan V2', () => {
  it('compiles a plan from profile + hardware + partitions + packages', () => {
    const profile = { ...DESKTOP_PROFILE, profileHash: 'hash' };
    const plan = compileBuildPlanV2({
      profile,
      target: 'raw',
      hardware: resolveHardwareTarget('virtual-machine'),
      partitions: defaultDesktopLayout(),
      packages: resolvePackages({ base: ['base-system'], extra: [] }).locked,
    });
    expect(plan.hardwareId).toBe('virtual-machine');
    expect(plan.architecture).toBe('amd64');
    expect(plan.partitionOk).toBe(true);
    expect(plan.blockingErrors).toHaveLength(0);
    expect(plan.items.length).toBeGreaterThan(10);
    expect(plan.planHash).toBeTruthy();
    expect(plan.items.every((i) => i.status === 'ready' || i.status === 'pending')).toBe(true);
  });

  it('marks stages blocked when the partition layout is invalid', () => {
    const profile = { ...DESKTOP_PROFILE, profileHash: 'hash' };
    const layout = {
      tableType: 'gpt',
      diskSizeBytes: 100 * 1024 * 1024 * 1024,
      partitions: [
        { name: 'Root', kind: 'root', sizeBytes: 150 * 1024 * 1024 * 1024, filesystem: 'ext4' },
      ],
    };
    const plan = compileBuildPlanV2({
      profile,
      target: 'raw',
      hardware: resolveHardwareTarget('generic-x86_64'),
      partitions: layout,
      packages: [],
    });
    expect(plan.partitionOk).toBe(false);
    expect(plan.blockingErrors.length).toBeGreaterThan(0);
    expect(plan.items.filter((i) => i.status === 'blocked').length).toBeGreaterThan(0);
  });
});

describe('IMG-038 preflight', () => {
  const base = {
    profile: { ...DESKTOP_PROFILE, profileHash: 'hash' },
    target: 'raw' as const,
    hardware: resolveHardwareTarget('virtual-machine'),
    diskFreeBytes: 100 * 1024 * 1024 * 1024,
    memoryAvailableBytes: 8 * 1024 * 1024 * 1024,
    memoryRequiredBytes: 2 * 1024 * 1024 * 1024,
    toolsAvailable: ['grub', 'plymouth', 'qemu', 'ovmf'],
    signingAvailable: true,
    outputWritable: true,
    repositoryReachable: true,
  };

  it('reports ready when everything is healthy', () => {
    const result = runPreflight(base);
    expect(result.verdict).toBe('ready');
    expect(result.blockingCount).toBe(0);
  });

  it('blocks on architecture mismatch and insufficient disk', () => {
    const result = runPreflight({ ...base, hardware: resolveHardwareTarget('raspberry-pi-4'), diskFreeBytes: 1024 });
    expect(result.verdict).toBe('blocked');
    expect(result.items.some((i) => i.status === 'fail' && i.category === 'hardware')).toBe(true);
    expect(result.items.some((i) => i.status === 'fail' && i.category === 'environment')).toBe(true);
  });

  it('warns when signing is unavailable but still ready-with-warnings', () => {
    const result = runPreflight({ ...base, signingAvailable: false });
    expect(result.verdict).toBe('ready-with-warnings');
    expect(result.items.some((i) => i.status === 'warn' && i.category === 'signing')).toBe(true);
  });
});

describe('IMG-039/040 build runs with checkpoints', () => {
  it('runs stages and persists checkpoints', () => {
    const controller = new BuildRunController();
    const run = controller.create({ profileId: 'p', target: 'raw' });
    controller.start(run.id);
    controller.markStageRunning(run.id, 'resolve-profile');
    controller.markStageCompleted(run.id, 'resolve-profile', ['resolved profile']);
    controller.markStageRunning(run.id, 'validate');
    controller.markStageCompleted(run.id, 'validate');

    const current = controller.get(run.id);
    expect(current.status).toBe('running');
    expect(controller.checkpointedStages(run.id)).toContain('validate');
    expect(current.stages[0]!.status).toBe('completed');
    expect(current.stages[0]!.log).toContain('resolved profile');
  });

  it('resumes from the last completed stage', () => {
    const controller = new BuildRunController();
    const first = controller.create({ profileId: 'p', target: 'raw' });
    controller.start(first.id);
    controller.markStageCompleted(first.id, 'resolve-profile');
    controller.markStageRunning(first.id, 'validate');
    controller.markStageFailed(first.id, 'validate', 'boom');
    expect(controller.get(first.id).status).toBe('failed');

    const resume = controller.create({ profileId: 'p', target: 'raw', resumedFromStage: 'validate' });
    expect(resume.resumedFromStage).toBe('validate');
    const resumedStage = resume.stages.find((s) => s.stage === 'resolve-profile')!;
    expect(resumedStage.status).toBe('completed');
    expect(resumedStage.checkpointed).toBe(true);
  });

  it('cancels and completes runs', () => {
    const controller = new BuildRunController();
    const run = controller.create({ profileId: 'p', target: 'raw' });
    controller.cancel(run.id);
    expect(controller.get(run.id).status).toBe('cancelled');
    controller.complete(run.id);
    expect(controller.get(run.id).status).toBe('completed');
  });
});
