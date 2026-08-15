import { describe, expect, it } from 'vitest';
import { SystemService } from '../../src/system/service/system-service.js';
import { AuthorizationService } from '../../src/auth/service/authorization-service.js';
import type { AuthenticationContext } from '../../src/auth/domain/identity.js';
import type { SystemDiscoveryPort } from '../../src/system/discovery/port.js';
import type { RecoveryBootControl, PowerControl } from '../../src/system/service/controls.js';

function ctx(permissions: string[]): AuthenticationContext {
  return { principal: { kind: 'human', identityId: 'idn_1' }, scopes: [], roles: [], permissions, assurance: 2, correlation: {} };
}

describe('SystemService (SYS-001/014)', () => {
  it('authorizes low-risk reads without permission', async () => {
    const service = new SystemService({ authorization: new AuthorizationService() });
    const discovery = await service.discover();
    expect(discovery.firmware.mode).toBeDefined();
    expect(discovery.hardware.cpu.logicalCores).toBeGreaterThan(0);
  });

  it('denies high-risk operations without the permission', async () => {
    const service = new SystemService({ authorization: new AuthorizationService() });
    expect(() => service.authorize(ctx([]), 'system.power.reboot')).toThrow();
  });

  it('allows high-risk operations with the permission', async () => {
    const service = new SystemService({ authorization: new AuthorizationService() });
    expect(() => service.authorize(ctx(['system.power.reboot']), 'system.power.reboot')).not.toThrow();
  });

  it('rejects unknown system capabilities', async () => {
    const service = new SystemService({ authorization: new AuthorizationService() });
    expect(() => service.authorize(ctx(['*']), 'system.nonexistent')).toThrow();
  });

  it('rejects arbitrary root operations unconditionally', () => {
    const service = new SystemService();
    expect(() => service.rejectArbitraryOperation(ctx(['*']))).toThrow();
  });

  it('delegates reboot to the power control after authorization', async () => {
    const power: PowerControl = { async request() { return { accepted: true, action: 'reboot' }; } };
    const service = new SystemService({ power, authorization: new AuthorizationService() });
    const result = await service.requestReboot(ctx(['system.power.reboot']), 'test');
    expect(result.accepted).toBe(true);
  });

  it('delegates recovery scheduling after authorization', async () => {
    const recovery: RecoveryBootControl = { async scheduleBoot() { return { scheduled: true, destination: 'recovery' }; } };
    const service = new SystemService({ recovery, authorization: new AuthorizationService() });
    const result = await service.scheduleRecovery(ctx(['system.recovery.scheduleBoot']), 'recovery', 'test');
    expect(result.scheduled).toBe(true);
  });

  it('exposes boot entries and slot state from the discovery adapter', async () => {
    const discovery: SystemDiscoveryPort = {
      async discover() {
        return {
          firmware: { mode: 'uefi', secureBoot: { status: 'supported', enabled: true }, tpm: { status: 'supported' }, uefiVariables: { status: 'supported' } },
          hardware: { cpu: { logicalCores: 4 }, memory: { totalBytes: 1024 }, storage: { totalBytes: 0, devices: [] }, network: { interfaces: [] } },
          bootloader: { detected: 'supported', type: 'grub' },
          detectedAt: new Date().toISOString(),
        };
      },
      async bootEntries() {
        return [{ id: 'a', label: 'Vestara A', source: 'grub', active: true, isVestara: true }];
      },
      async slotState() {
        return { activeSlot: 'A', bootedSlot: 'A', bootAttempts: 1, slotHealth: { A: 'healthy', B: 'empty', recovery: 'unknown', none: 'empty' } };
      },
    };
    const service = new SystemService({ discovery });
    expect((await service.bootEntries())[0]!.id).toBe('a');
    expect((await service.slotState())?.activeSlot).toBe('A');
  });
});
