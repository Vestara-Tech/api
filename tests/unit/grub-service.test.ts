import { describe, expect, it } from 'vitest';
import { GrubConfigurationService } from '../../src/system/grub/service/grub-configuration-service.js';
import type { GrubAdapter } from '../../src/system/grub/adapters/grub-adapter.js';
import { normalizeGrubConfiguration } from '../../src/system/grub/domain/configuration.js';
import type { BootEntry } from '../../src/system/domain/boot.js';

/** A scripted adapter for the governed-pipeline test. */
function makeAdapter(initial = { timeoutSeconds: 5 }): { adapter: GrubAdapter; calls: string[]; applied: { timeoutSeconds: number } } {
  const calls: string[] = [];
  const applied = { timeoutSeconds: initial.timeoutSeconds };
  return {
    calls,
    applied,
    adapter: {
      async discover() {
        return { available: true, version: '2.06' };
      },
      async read() {
        return normalizeGrubConfiguration({ timeoutSeconds: applied.timeoutSeconds });
      },
      async backup() {
        calls.push('backup');
        return { ok: true };
      },
      async apply(configuration) {
        calls.push('apply');
        applied.timeoutSeconds = configuration.timeoutSeconds;
        return { ok: true };
      },
      async regenerate() {
        calls.push('regenerate');
        return { ok: true };
      },
      async verify() {
        calls.push('verify');
        return { ok: true };
      },
      async rollback() {
        calls.push('rollback');
        applied.timeoutSeconds = initial.timeoutSeconds;
        return { ok: true };
      },
      async setDefault() {
        calls.push('setDefault');
        return { ok: true };
      },
      async setNext() {
        calls.push('setNext');
        return { ok: true };
      },
      async listEntries(): Promise<readonly BootEntry[]> {
        return [
          { id: 'vestara-a', label: 'Vestara A', source: 'grub', active: true, isVestara: true },
          { id: 'vestara-recovery', label: 'Vestara Recovery', source: 'grub', active: false, isVestara: true },
        ];
      },
      async applyTheme() {
        calls.push('applyTheme');
        return { ok: true };
      },
    },
  };
}

describe('GrubConfigurationService (SYS-019..022)', () => {
  it('previews a config change and reports requiresReboot', async () => {
    const { adapter } = makeAdapter();
    const service = new GrubConfigurationService({ adapter, bootAttemptThreshold: 2 });
    const preview = await service.preview({ timeoutSeconds: 10 });
    expect(preview.changed).toBe(true);
    expect(preview.requiresReboot).toBe(true);
    expect(preview.candidate.timeoutSeconds).toBe(10);
  });

  it('rejects apply without approval', async () => {
    const { adapter } = makeAdapter();
    const service = new GrubConfigurationService({ adapter });
    await expect(service.apply({ timeoutSeconds: 10 }, false)).rejects.toThrow(/approval/i);
  });

  it('runs the governed apply pipeline in order', async () => {
    const { adapter, calls } = makeAdapter();
    const service = new GrubConfigurationService({ adapter });
    await service.apply({ timeoutSeconds: 10 }, true);
    expect(calls).toEqual(['backup', 'apply', 'regenerate', 'verify']);
    expect(service.getState().status).toBe('pending-reboot-verification');
    expect(service.getState().lastAppliedHash).toBeDefined();
  });

  it('verifies after successful boot', async () => {
    const { adapter } = makeAdapter();
    const service = new GrubConfigurationService({ adapter });
    await service.apply({ timeoutSeconds: 10 }, true);
    await service.recordBootResult(true);
    expect(service.getState().status).toBe('verified');
  });

  it('increments bootAttempts and rolls back at threshold', async () => {
    const { adapter, calls, applied } = makeAdapter();
    const service = new GrubConfigurationService({ adapter, bootAttemptThreshold: 2 });
    await service.apply({ timeoutSeconds: 10 }, true);
    await service.recordBootResult(false);
    expect(service.getState().bootAttempts).toBe(1);
    await service.recordBootResult(false);
    expect(service.getState().status).toBe('failed');
    expect(calls).toContain('rollback');
    expect(applied.timeoutSeconds).toBe(5); // restored known-good
  });

  it('sets default and next boot entries through the abstraction', async () => {
    const { adapter, calls } = makeAdapter();
    const service = new GrubConfigurationService({ adapter });
    await service.setDefault('vestara-a');
    await service.setNext('vestara-recovery');
    expect(calls).toContain('setDefault');
    expect(calls).toContain('setNext');
    await expect(service.setDefault('nonexistent')).rejects.toThrow();
  });

  it('rejects dangerous kernel parameters at apply', async () => {
    const { adapter } = makeAdapter();
    const service = new GrubConfigurationService({ adapter });
    const preview = await service.validate({ timeoutSeconds: 10, kernelParameters: ['quiet', 'single'] });
    expect(preview.validation.ok).toBe(false);
    await expect(service.apply({ timeoutSeconds: 10, kernelParameters: ['quiet', 'single'] }, true)).rejects.toThrow(/validation/i);
  });
});
