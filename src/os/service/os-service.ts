import { OS_CAPABILITIES, getOsCapability, hasOsCapability, type OsCapabilityDefinition } from '../domain/os-capability.js';
import type { OsProfile } from '../domain/os-profile.js';
import type { OsChangePlan, OsDiff, OsStateModel } from '../domain/os-state.js';
import { createOsStateModel, diffOsProfiles, planOsChanges } from '../domain/os-state.js';
import type { OsCurrentState, OsDesiredState } from '../domain/os-state.js';
import type { OsDiscoveryPort } from '../discovery/environment-discovery.js';
import { EnvironmentOsDiscovery, InMemoryOsDesiredStore, type OsDesiredStorePort } from '../discovery/environment-discovery.js';

export interface OsServiceOptions {
  readonly discovery?: OsDiscoveryPort;
  readonly desiredStore?: OsDesiredStorePort;
}

/**
 * OS — OS Module service. Composes discovery (current), the desired-state
 * store, the diff engine and the change planner. The OS Module owns OS
 * identity/distribution/profile/state; the System Module provides the
 * privileged execution boundary underneath.
 */
export class OsService {
  private readonly discovery: OsDiscoveryPort;
  private readonly desiredStore: OsDesiredStorePort;

  constructor(options: OsServiceOptions = {}) {
    this.discovery = options.discovery ?? new EnvironmentOsDiscovery();
    this.desiredStore = options.desiredStore ?? new InMemoryOsDesiredStore();
  }

  capabilities(): readonly OsCapabilityDefinition[] {
    return OS_CAPABILITIES;
  }

  hasCapability(id: string): boolean {
    return hasOsCapability(id);
  }

  getCapability(id: string): OsCapabilityDefinition | undefined {
    return getOsCapability(id);
  }

  async current(): Promise<OsCurrentState> {
    return this.discovery.discoverCurrent();
  }

  getDesired(): OsDesiredState | undefined {
    return this.desiredStore.get();
  }

  setDesired(profile: OsProfile): OsDesiredState {
    const previous = this.desiredStore.get();
    const desired: OsDesiredState = {
      profile,
      revision: (previous?.revision ?? 0) + 1,
      updatedAt: new Date().toISOString(),
    };
    this.desiredStore.save(desired);
    return desired;
  }

  async stateModel(): Promise<OsStateModel> {
    const current = await this.current();
    const desired = this.getDesired();
    if (!desired) return { current, desired: { profile: current.profile, revision: 0, updatedAt: current.capturedAt }, driftCount: 0 };
    return createOsStateModel(current, desired);
  }

  async diff(): Promise<OsDiff> {
    const current = await this.current();
    const desired = this.getDesired() ?? { profile: current.profile, revision: 0, updatedAt: current.capturedAt };
    return diffOsProfiles(current.profile, desired.profile);
  }

  async plan(): Promise<OsChangePlan> {
    return planOsChanges(await this.diff());
  }
}
