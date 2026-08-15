import { describe, expect, it } from 'vitest';
import { normalizeGrubConfiguration, hashGrubConfiguration, toSnapshot } from '../../src/system/grub/domain/configuration.js';
import { evaluateKernelParam, validateKernelParams } from '../../src/system/grub/domain/kernel-params.js';
import { getSystemCapability, hasSystemCapability, FORBIDDEN_SYSTEM_OPERATIONS } from '../../src/system/domain/capabilities.js';

describe('GrubConfiguration model (SYS-019)', () => {
  it('normalizes with defaults', () => {
    const config = normalizeGrubConfiguration({ timeoutStyle: 'countdown' });
    expect(config.timeoutSeconds).toBe(5);
    expect(config.timeoutStyle).toBe('countdown');
    expect(config.recovery.enabled).toBe(true);
    expect(config.osProber.enabled).toBe(true);
    expect(config.kernelParameters).toContain('quiet');
  });

  it('computes a deterministic configuration hash', () => {
    const a = normalizeGrubConfiguration({ timeoutSeconds: 3 });
    const b = normalizeGrubConfiguration({ timeoutSeconds: 3 });
    const c = normalizeGrubConfiguration({ timeoutSeconds: 10 });
    expect(hashGrubConfiguration(a)).toBe(hashGrubConfiguration(b));
    expect(hashGrubConfiguration(a)).not.toBe(hashGrubConfiguration(c));
    const snapshot = toSnapshot(a);
    expect(snapshot.configurationHash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('kernel-parameter governance (SYS-019)', () => {
  it('allows safe parameters', () => {
    expect(evaluateKernelParam('quiet').verdict).toBe('allow');
    expect(evaluateKernelParam('splash').verdict).toBe('allow');
    expect(evaluateKernelParam('loglevel=3').verdict).toBe('allow');
  });

  it('rejects dangerous parameters', () => {
    expect(evaluateKernelParam('init=/bin/bash').verdict).toBe('reject');
    expect(evaluateKernelParam('single').verdict).toBe('reject');
    expect(evaluateKernelParam('emergency').verdict).toBe('reject');
  });

  it('flags unknown parameters for escalation', () => {
    expect(evaluateKernelParam('totally-unknown-flag').requiresEscalation).toBe(true);
  });

  it('blocks a config that contains dangerous params', () => {
    const result = validateKernelParams(['quiet', 'single']);
    expect(result.ok).toBe(false);
    expect(result.blocked.map((b) => b.parameter)).toContain('single');
  });
});

describe('GRUB capabilities boundary', () => {
  it('classifies GRUB ops as low/high', () => {
    expect(getSystemCapability('system.boot.grub.read')?.risk).toBe('low');
    expect(getSystemCapability('system.boot.grub.configuration.apply')?.risk).toBe('high');
    expect(getSystemCapability('system.boot.grub.entry.setNext')?.risk).toBe('high');
  });

  it('deliberately forbids raw GRUB writes', () => {
    expect(FORBIDDEN_SYSTEM_OPERATIONS).toContain('system.boot.grub.writeArbitrary');
    expect(FORBIDDEN_SYSTEM_OPERATIONS).toContain('system.boot.grub.rawConfigWrite');
    expect(hasSystemCapability('system.boot.grub.rawConfigWrite')).toBe(false);
  });
});
