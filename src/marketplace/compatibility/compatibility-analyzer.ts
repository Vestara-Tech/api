import type { PackageCompatibility, VestaraPackage } from '../contracts/package.js';

export interface CompatibilityFactor {
  readonly label: string;
  readonly ok: boolean;
  readonly detail: string;
}

export interface CompatibilityAnalysis {
  readonly packageId: string;
  readonly version: string;
  readonly compatible: boolean;
  readonly factors: readonly CompatibilityFactor[];
  readonly conflicts: readonly string[];
  readonly warnings: readonly string[];
}

export interface SystemCompatibilityContext {
  readonly apiVersion: string;
  readonly platformVersion: string;
  readonly os: string;
  readonly architecture: string;
  readonly nodeVersion: string;
  readonly moduleVersions: Readonly<Record<string, string>>;
}

/** MKT-010 — Compatibility analyzer: not just semver, full context check. */
export class CompatibilityAnalyzer {
  analyze(pkg: VestaraPackage, ctx: SystemCompatibilityContext): CompatibilityAnalysis {
    const factors: CompatibilityFactor[] = [];
    const warnings: string[] = [];
    const conflicts: string[] = [];

    const comp = pkg.compatibility;
    if (comp.apiRange) {
      const ok = versionSatisfies(ctx.apiVersion, comp.apiRange);
      factors.push({ label: 'Vestara API', ok, detail: `${ctx.apiVersion} vs ${comp.apiRange}` });
    }
    if (comp.platformRange) {
      const ok = versionSatisfies(ctx.platformVersion, comp.platformRange);
      factors.push({ label: 'Platform', ok, detail: `${ctx.platformVersion} vs ${comp.platformRange}` });
    }
    if (comp.os && comp.os.length > 0) {
      const ok = comp.os.includes(ctx.os);
      factors.push({ label: 'Operating System', ok, detail: ok ? ctx.os : `${ctx.os} not in [${comp.os.join(', ')}]` });
    }
    if (comp.architectures && comp.architectures.length > 0) {
      const ok = comp.architectures.includes(ctx.architecture);
      factors.push({ label: 'Architecture', ok, detail: ok ? ctx.architecture : `${ctx.architecture} not supported` });
    }
    if (comp.nodeRange) {
      const ok = versionSatisfies(ctx.nodeVersion, comp.nodeRange);
      factors.push({ label: 'Node', ok, detail: `${ctx.nodeVersion} vs ${comp.nodeRange}` });
    }
    for (const req of comp.requires ?? []) {
      const installed = ctx.moduleVersions[req.module];
      const ok = installed !== undefined && versionSatisfies(installed, req.range);
      factors.push({ label: `Module ${req.module}`, ok, detail: ok ? `${installed} satisfies ${req.range}` : `${installed ?? 'missing'} vs ${req.range}` });
    }
    for (const conflict of comp.conflicts ?? []) {
      if (ctx.moduleVersions[conflict] !== undefined) conflicts.push(conflict);
    }
    for (const cap of pkg.capabilities) {
      if (cap.optional && !cap.description) warnings.push(`Optional capability "${cap.id}" has no description`);
    }

    return {
      packageId: pkg.id,
      version: pkg.version,
      compatible: factors.every((f) => f.ok) && conflicts.length === 0,
      factors,
      conflicts,
      warnings,
    };
  }
}

function versionSatisfies(version: string, range: string): boolean {
  const trim = range.trim();
  const m = trim.match(/^>=\s*(\d+)\.(\d+)\.(\d+)/);
  if (m) {
    return compare(version, `${m[1]}.${m[2]}.${m[3]}`) >= 0;
  }
  return version === trim;
}

function compare(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < 3; i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}
