import { badRequest } from '../../core/errors.js';
import type { PackageLifecycleStatus, VestaraPackage } from '../contracts/package.js';
import { LocalPackageRegistry } from '../registry/local-package-registry.js';

/**
 * MKT-016..019 — Package lifecycle: enable/disable, uninstall, update and
 * rollback. Preserves known-good revisions so a failed update rolls back.
 */
export class PackageLifecycleService {
  private readonly registry: LocalPackageRegistry;

  constructor(registry: LocalPackageRegistry) {
    this.registry = registry;
  }

  enable(packageId: string): VestaraPackage {
    this.requireInstalled(packageId);
    this.registry.setInstalledStatus(packageId, 'enabled');
    return this.registry.get(packageId);
  }

  disable(packageId: string): VestaraPackage {
    this.requireInstalled(packageId);
    this.registry.setInstalledStatus(packageId, 'disabled');
    return this.registry.get(packageId);
  }

  uninstall(packageId: string): { removed: boolean } {
    this.requireInstalled(packageId);
    this.registry.setInstalledStatus(packageId, 'uninstalling');
    this.registry.forceRemove(packageId);
    return { removed: true };
  }

  /** Stage a new version; if verification fails, roll back to the known-good. */
  update(packageId: string): { from: string; to: string; status: PackageLifecycleStatus } {
    const installed = this.registry.getInstalled(packageId);
    const available = this.registry.get(packageId);
    const from = installed.version;
    const to = available.version;
    this.registry.setInstalledStatus(packageId, 'update-available', { knownGoodVersion: from, version: to });
    // Simulate staged activation with verification; roll back on mismatch.
    const ok = available.provenance.verified;
    if (!ok) {
      this.registry.setInstalledStatus(packageId, 'installed', { version: from });
      return { from, to, status: 'installed' };
    }
    this.registry.setInstalledStatus(packageId, 'enabled', { version: to });
    return { from, to, status: 'enabled' };
  }

  rollback(packageId: string): { from: string; to: string } {
    const installed = this.registry.getInstalled(packageId);
    const knownGood = installed.knownGoodVersion;
    if (!knownGood) throw badRequest(`Package "${packageId}" has no known-good version to roll back to`);
    const from = installed.version;
    const next = { version: knownGood };
    this.registry.setInstalledStatus(packageId, 'enabled', next);
    return { from, to: knownGood };
  }

  private requireInstalled(packageId: string): void {
    if (!this.registry.isInstalled(packageId)) {
      throw badRequest(`Package "${packageId}" is not installed`);
    }
  }
}
