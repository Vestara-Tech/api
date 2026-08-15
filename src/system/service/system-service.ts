import { forbidden, notFound } from '../../core/errors.js';
import { AuthorizationService } from '../../auth/service/authorization-service.js';
import type { AuthenticationContext } from '../../auth/domain/identity.js';
import { SYSTEM_CAPABILITIES, getSystemCapability, hasSystemCapability, type SystemCapabilityDefinition } from '../domain/capabilities.js';
import type { SystemDiscoveryPort } from '../discovery/port.js';
import { EnvironmentSystemDiscovery } from '../adapters/environment.js';
import type { RecoveryBootControl, PowerControl } from './controls.js';
import type { BootEntry } from '../domain/boot.js';
import type { SlotState } from '../domain/slots.js';

export interface SystemServiceOptions {
  readonly discovery?: SystemDiscoveryPort;
  readonly recovery?: RecoveryBootControl;
  readonly power?: PowerControl;
  readonly authorization?: AuthorizationService;
}

export class SystemService {
  private readonly discovery: SystemDiscoveryPort;
  private readonly recovery: RecoveryBootControl | undefined;
  private readonly power: PowerControl | undefined;
  private readonly authorization: AuthorizationService;

  constructor(options: SystemServiceOptions = {}) {
    this.discovery = options.discovery ?? new EnvironmentSystemDiscovery();
    this.recovery = options.recovery;
    this.power = options.power;
    this.authorization = options.authorization ?? new AuthorizationService();
  }

  capabilities(): readonly SystemCapabilityDefinition[] {
    return SYSTEM_CAPABILITIES;
  }

  hasCapability(id: string): boolean {
    return hasSystemCapability(id);
  }

  async discover() {
    return this.discovery.discover();
  }

  async bootEntries(): Promise<readonly BootEntry[]> {
    return this.discovery.bootEntries();
  }

  async slotState(): Promise<SlotState | null> {
    return this.discovery.slotState();
  }

  /**
   * Every privileged operation is gated by the system capability boundary:
   * the caller must hold the permission AND the operation must be one of the
   * narrow declared capabilities (never arbitrary root).
   */
  authorize(ctx: AuthenticationContext, capabilityId: string): void {
    const capability = getSystemCapability(capabilityId);
    if (!capability) throw notFound(`Unknown system capability "${capabilityId}"`);
    // Enforce risk-based approval for high/critical operations.
    if (capability.risk === 'high' || capability.risk === 'critical') {
      this.authorization.requirePermission(ctx, capabilityId);
    }
  }

  async requestReboot(ctx: AuthenticationContext, reason?: string): Promise<{ accepted: boolean }> {
    this.authorize(ctx, 'system.power.reboot');
    if (!this.power) throw notFound('Power control not available');
    const result = await this.power.request({ action: 'reboot', ...(reason !== undefined ? { reason } : {}) });
    return { accepted: result.accepted };
  }

  async requestShutdown(ctx: AuthenticationContext, reason?: string): Promise<{ accepted: boolean }> {
    this.authorize(ctx, 'system.power.shutdown');
    if (!this.power) throw notFound('Power control not available');
    const result = await this.power.request({ action: 'shutdown', ...(reason !== undefined ? { reason } : {}) });
    return { accepted: result.accepted };
  }

  async scheduleRecovery(ctx: AuthenticationContext, destination: 'recovery' | 'slot-a' | 'slot-b', reason?: string): Promise<{ scheduled: boolean }> {
    this.authorize(ctx, 'system.recovery.scheduleBoot');
    if (!this.recovery) throw notFound('Recovery boot control not available');
    const result = await this.recovery.scheduleBoot({ destination, ...(reason !== undefined ? { reason } : {}) });
    return { scheduled: result.scheduled };
  }

  /** Deliberately absent operations are rejected unconditionally. */
  rejectArbitraryOperation(ctx: AuthenticationContext): never {
    void ctx;
    throw forbidden('Arbitrary system operations are not permitted');
  }
}
