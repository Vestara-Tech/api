import { describe, expect, it } from 'vitest';
import { SYSTEM_CAPABILITIES, getSystemCapability, hasSystemCapability, FORBIDDEN_SYSTEM_OPERATIONS } from '../../src/system/domain/capabilities.js';
import { createBootOrder } from '../../src/system/domain/boot.js';
import { createSlotState, isSlotHealthy } from '../../src/system/domain/slots.js';

describe('system capability boundary (SYS-002)', () => {
  it('classifies read ops as low risk without approval', () => {
    const read = getSystemCapability('system.firmware.read')!;
    expect(read.risk).toBe('low');
    expect(read.requiresApproval).toBe(false);
  });

  it('classifies write/control ops as high risk with approval', () => {
    expect(getSystemCapability('system.boot.next.write')!.risk).toBe('high');
    expect(getSystemCapability('system.boot.next.write')!.requiresApproval).toBe(true);
    expect(getSystemCapability('system.power.reboot')!.risk).toBe('high');
    expect(getSystemCapability('system.recovery.scheduleBoot')!.risk).toBe('high');
  });

  it('classifies firmware ops as critical', () => {
    expect(getSystemCapability('system.firmware.update')!.risk).toBe('critical');
    expect(getSystemCapability('system.firmware.logo.apply')!.risk).toBe('critical');
    expect(getSystemCapability('system.secureBoot.key.write')!.risk).toBe('critical');
  });

  it('exposes all declared capabilities', () => {
    expect(SYSTEM_CAPABILITIES.length).toBeGreaterThan(15);
    expect(hasSystemCapability('system.boot.next.read')).toBe(true);
  });

  it('deliberately forbids arbitrary root operations', () => {
    expect(FORBIDDEN_SYSTEM_OPERATIONS).toContain('system.shell.root');
    expect(FORBIDDEN_SYSTEM_OPERATIONS).toContain('system.efivar.writeArbitrary');
    expect(hasSystemCapability('system.shell.root')).toBe(false);
  });
});

describe('boot entry model (SYS-010)', () => {
  it('builds a boot order with entries', () => {
    const order = createBootOrder(
      [
        { id: 'vestara-a', label: 'Vestara A', source: 'grub', active: true, isVestara: true },
        { id: 'recovery', label: 'Vestara Recovery', source: 'grub', active: false, isVestara: true },
      ],
      'recovery',
    );
    expect(order.entries).toHaveLength(2);
    expect(order.nextBootId).toBe('recovery');
    expect(order.nextBootSet).toBe(true);
  });
});

describe('A/B slot state (SYS-011)', () => {
  it('tracks active/booted slots and health', () => {
    const state = createSlotState({
      activeSlot: 'A',
      bootedSlot: 'A',
      bootAttempts: 1,
      slotHealth: { A: 'healthy', B: 'empty', recovery: 'unknown', none: 'empty' },
      previousKnownGoodSlot: 'A',
    });
    expect(isSlotHealthy(state)).toBe(true);
    expect(state.nextSlot).toBeUndefined();
  });

  it('reports unhealthy booted slot', () => {
    const state = createSlotState({
      activeSlot: 'A',
      bootedSlot: 'B',
      bootAttempts: 2,
      slotHealth: { A: 'healthy', B: 'failed', recovery: 'unknown', none: 'empty' },
    });
    expect(isSlotHealthy(state)).toBe(false);
  });
});
