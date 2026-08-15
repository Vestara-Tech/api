import type { PackageDependency, VestaraPackage } from '../contracts/package.js';
import type { LocalPackageRegistry } from '../registry/local-package-registry.js';

/** MKT-009 — Dependency resolver. Validates that dependencies are satisfiable. */
export class DependencyResolver {
  private readonly registry: LocalPackageRegistry;

  constructor(registry: LocalPackageRegistry) {
    this.registry = registry;
  }

  resolve(pkg: VestaraPackage, installed: boolean): readonly { dependency: PackageDependency; satisfied: boolean; message: string }[] {
    return pkg.dependencies.map((dependency) => {
      if (dependency.packageId === 'vestara.integration' || dependency.packageId === 'vestara.permission') {
        // Platform modules are always present in Vestara.
        return { dependency, satisfied: true, message: 'platform module present' };
      }
      const available = this.registry.has(dependency.packageId);
      if (!available) return { dependency, satisfied: false, message: `package "${dependency.packageId}" not available` };
      const candidate = this.registry.get(dependency.packageId);
      const versionOk = satisfies(candidate.version, dependency.versionRange);
      return { dependency, satisfied: versionOk, message: versionOk ? 'version satisfies range' : `version ${candidate.version} outside ${dependency.versionRange}` };
    });
  }

  unresolved(pkg: VestaraPackage, installed: boolean): readonly PackageDependency[] {
    return this.resolve(pkg, installed).filter((r) => !r.satisfied).map((r) => r.dependency);
  }
}

/** Minimal semver-range check (supports >=X.Y.Z and X.Y.Z). */
export function satisfies(version: string, range: string): boolean {
  const trim = range.trim();
  const m = trim.match(/^>=\s*(\d+)\.(\d+)\.(\d+)/);
  if (m) {
    const v = parse(version);
    const r = parse(`${m[1]}.${m[2]}.${m[3]}`);
    return cmp(v, r) >= 0;
  }
  return version === trim;
}

function parse(v: string): number[] {
  return v.split('.').map((n) => Number.parseInt(n, 10) || 0);
}

function cmp(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
