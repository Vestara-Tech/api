import type { VestaraPackage } from '../contracts/package.js';

export interface PermissionAnalysisResult {
  readonly packageId: string;
  readonly permissionCount: number;
  readonly low: number;
  readonly medium: number;
  readonly high: number;
  readonly critical: number;
  readonly requireApproval: readonly string[];
}

export type PackageRisk = 'low' | 'medium' | 'high' | 'critical';

const RISK_BY_PERMISSION: Readonly<Record<string, PackageRisk>> = {
  'file.read': 'low',
  'repository.read': 'low',
  'file.write': 'medium',
  'repository.write': 'medium',
  'pull-request.create': 'medium',
  'credential.github': 'high',
  'network.github.com': 'medium',
  'process.execute': 'high',
  'workflow.execute': 'high',
  'system.shell.root': 'critical',
};

/**
 * MKT-013 — Permission analysis. Marketplace only DECLARES and requests
 * permissions; the Permission Module owns the authority decision.
 */
export class PermissionAnalyzer {
  analyze(pkg: VestaraPackage): PermissionAnalysisResult {
    const requireApproval: string[] = [];
    const counts = { low: 0, medium: 0, high: 0, critical: 0 };
    for (const permission of pkg.permissions) {
      const risk = RISK_BY_PERMISSION[permission.id] ?? 'medium';
      counts[risk] += 1;
      if (permission.approval === 'explicit' || risk === 'high' || risk === 'critical') {
        requireApproval.push(permission.id);
      }
    }
    return {
      packageId: pkg.id,
      permissionCount: pkg.permissions.length,
      low: counts.low,
      medium: counts.medium,
      high: counts.high,
      critical: counts.critical,
      requireApproval,
    };
  }
}
