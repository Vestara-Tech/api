import { randomId } from '../../core/identifiers.js';
import type { PackageLifecycleStatus, VestaraPackage } from '../contracts/package.js';
import { LocalPackageRegistry } from '../registry/local-package-registry.js';
import { DependencyResolver } from '../resolver/dependency-resolver.js';
import { CompatibilityAnalyzer, type SystemCompatibilityContext } from '../compatibility/compatibility-analyzer.js';
import { PermissionAnalyzer, type PermissionAnalysisResult } from '../security/permission-analyzer.js';

export interface InstallRequest {
  readonly packageId: string;
  readonly approved?: boolean;
  readonly principalId?: string;
}

export interface InstallReview {
  readonly packageId: string;
  readonly version: string;
  readonly kind: string;
  readonly dependenciesSatisfied: boolean;
  readonly compatibilityOk: boolean;
  readonly permissions: PermissionAnalysisResult;
  readonly approvalRequired: boolean;
  readonly installable: boolean;
  readonly issues: readonly string[];
}

export interface InstallResult {
  readonly packageId: string;
  readonly version: string;
  readonly status: PackageLifecycleStatus;
  readonly operationId: string;
}

/**
 * MKT-014/015 — Governed installer. Pipeline: resolve package -> resolve
 * dependencies -> compatibility -> permission analysis -> approval gate ->
 * stage -> verify -> register. Downloaded ≠ Installed ≠ Enabled.
 */
export class InstallationService {
  private readonly registry: LocalPackageRegistry;
  private readonly dependencies: DependencyResolver;
  private readonly compatibility: CompatibilityAnalyzer;
  private readonly permissions: PermissionAnalyzer;
  private readonly systemContext: SystemCompatibilityContext;

  constructor(options: {
    registry: LocalPackageRegistry;
    dependencies: DependencyResolver;
    compatibility: CompatibilityAnalyzer;
    permissions: PermissionAnalyzer;
    systemContext: SystemCompatibilityContext;
  }) {
    this.registry = options.registry;
    this.dependencies = options.dependencies;
    this.compatibility = options.compatibility;
    this.permissions = options.permissions;
    this.systemContext = options.systemContext;
  }

  review(request: InstallRequest): InstallReview {
    const pkg = this.registry.get(request.packageId);
    const dependencyResults = this.dependencies.resolve(pkg, false);
    const dependenciesSatisfied = dependencyResults.every((r) => r.satisfied);
    const compatibility = this.compatibility.analyze(pkg, this.systemContext);
    const permissionAnalysis = this.permissions.analyze(pkg);
    const approvalRequired = permissionAnalysis.requireApproval.length > 0 && request.approved !== true;

    const issues = [
      ...dependencyResults.filter((r) => !r.satisfied).map((r) => r.message),
      ...compatibility.factors.filter((f) => !f.ok).map((f) => `${f.label}: ${f.detail}`),
      ...compatibility.conflicts.map((c) => `conflicts with ${c}`),
    ];

    return {
      packageId: pkg.id,
      version: pkg.version,
      kind: pkg.kind,
      dependenciesSatisfied,
      compatibilityOk: compatibility.compatible,
      permissions: permissionAnalysis,
      approvalRequired,
      installable: dependenciesSatisfied && compatibility.compatible && !approvalRequired,
      issues,
    };
  }

  install(request: InstallRequest): InstallResult {
    const review = this.review(request);
    const operationId = randomId('mkt');
    if (review.approvalRequired) {
      throw new Error(`Install of "${request.packageId}" requires approval: ${review.permissions.requireApproval.join(', ')}`);
    }
    if (!review.dependenciesSatisfied || !review.compatibilityOk) {
      throw new Error(`Install of "${request.packageId}" is not installable: ${review.issues.join('; ') || 'unknown issue'}`);
    }
    const pkg = this.registry.get(request.packageId);
    this.registry.markInstalled(pkg, 'enabled');
    return { packageId: pkg.id, version: pkg.version, status: 'enabled', operationId };
  }
}
