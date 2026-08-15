import { conflict, notFound } from '../../core/errors.js';
import type { InstalledPackage, PackageLifecycleStatus, VestaraPackage } from '../contracts/package.js';

/**
 * MKT-004 — Local package registry + installed store. The local registry is
 * authoritative for the machine; a cloud registry is never the source of truth
 * for what is installed.
 */
export class LocalPackageRegistry {
  private readonly available = new Map<string, VestaraPackage>();
  private readonly installed = new Map<string, InstalledPackage>();

  /** Catalog a package as available (built-in/local/registry source). */
  catalog(pkg: VestaraPackage): void {
    this.available.set(pkg.id, pkg);
  }

  get(id: string): VestaraPackage {
    const pkg = this.available.get(id);
    if (!pkg) throw notFound(`Package "${id}" not found in catalog`);
    return pkg;
  }

  has(id: string): boolean {
    return this.available.has(id);
  }

  listAvailable(): readonly VestaraPackage[] {
    return [...this.available.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  markInstalled(pkg: VestaraPackage, status: PackageLifecycleStatus = 'installed'): InstalledPackage {
    const record: InstalledPackage = {
      packageId: pkg.id,
      version: pkg.version,
      status,
      installedAt: new Date().toISOString(),
      enabled: status === 'enabled' || status === 'running',
      permissions: pkg.permissions,
    };
    this.installed.set(pkg.id, record);
    return record;
  }

  getInstalled(id: string): InstalledPackage {
    const record = this.installed.get(id);
    if (!record) throw notFound(`Package "${id}" is not installed`);
    return record;
  }

  isInstalled(id: string): boolean {
    return this.installed.has(id);
  }

  setInstalledStatus(id: string, status: PackageLifecycleStatus, patch: Partial<InstalledPackage> = {}): InstalledPackage {
    const current = this.getInstalled(id);
    const next: InstalledPackage = { ...current, ...patch, status, enabled: status === 'enabled' || status === 'running', updatedAt: new Date().toISOString() };
    this.installed.set(id, next);
    return next;
  }

  uninstall(id: string): boolean {
    if (this.installed.has(id)) throw conflict(`Package "${id}" is installed; uninstall through the lifecycle service`);
    return this.installed.delete(id);
  }

  forceRemove(id: string): boolean {
    return this.installed.delete(id);
  }

  listInstalled(): readonly InstalledPackage[] {
    return [...this.installed.values()].sort((a, b) => a.packageId.localeCompare(b.packageId));
  }
}
