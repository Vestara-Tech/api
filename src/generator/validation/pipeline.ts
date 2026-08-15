import type { ArtifactSet } from '../artifacts/artifact-set.js';
import { isSecretReference } from '../../configuration/domain/secret.js';

export type ArtifactValidationSeverity = 'error' | 'warning' | 'info';

export interface ArtifactValidationIssue {
  readonly path: string;
  readonly severity: ArtifactValidationSeverity;
  readonly message: string;
  readonly code: string;
}

export interface ArtifactValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ArtifactValidationIssue[];
  readonly validatedArtifactCount: number;
}

export interface ArtifactValidationRule {
  readonly id: string;
  validate(artifacts: ArtifactSet): readonly ArtifactValidationIssue[];
}

/**
 * Path-safety check: generated artifacts must stay inside the target root.
 * Rejects absolute paths and `..` traversal.
 */
export function assertSafePath(path: string): void {
  if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) {
    throw new Error(`Generated artifact path must be relative: "${path}"`);
  }
  const parts = path.split(/[\\/]/);
  if (parts.some((p) => p === '..')) {
    throw new Error(`Generated artifact path escapes the target root: "${path}"`);
  }
}

export interface ValidationPipelineOptions {
  readonly maxTotalBytes?: number;
  readonly maxFileCount?: number;
  readonly requiredFiles?: readonly string[];
}

/**
 * Validation pipeline (GEN-008). Validates the artifact set structurally and
 * through injected rules before any preview/apply.
 */
export class ArtifactValidationPipeline {
  private readonly rules: readonly ArtifactValidationRule[];
  private readonly options: ValidationPipelineOptions;

  constructor(rules: readonly ArtifactValidationRule[] = [], options: ValidationPipelineOptions = {}) {
    this.rules = rules;
    this.options = options;
  }

  validate(artifacts: ArtifactSet): ArtifactValidationResult {
    const issues: ArtifactValidationIssue[] = [];

    for (const artifact of artifacts.all()) {
      try {
        assertSafePath(artifact.path);
      } catch (err) {
        issues.push({
          path: artifact.path,
          severity: 'error',
          message: err instanceof Error ? err.message : 'unsafe path',
          code: 'unsafe-path',
        });
      }
    }

    if (this.options.maxFileCount !== undefined && artifacts.size() > this.options.maxFileCount) {
      issues.push({
        path: '*',
        severity: 'error',
        message: `artifact count ${artifacts.size()} exceeds max ${this.options.maxFileCount}`,
        code: 'max-file-count',
      });
    }

    if (this.options.maxTotalBytes !== undefined) {
      const total = artifacts.all().reduce((sum, a) => sum + Buffer.byteLength(a.content, 'utf8'), 0);
      if (total > this.options.maxTotalBytes) {
        issues.push({
          path: '*',
          severity: 'error',
          message: `total size ${total} exceeds max ${this.options.maxTotalBytes}`,
          code: 'max-total-bytes',
        });
      }
    }

    for (const required of this.options.requiredFiles ?? []) {
      if (!artifacts.has(required)) {
        issues.push({
          path: required,
          severity: 'error',
          message: `required artifact missing: ${required}`,
          code: 'missing-required',
        });
      }
    }

    for (const rule of this.rules) {
      issues.push(...rule.validate(artifacts));
    }

    return {
      ok: issues.every((i) => i.severity !== 'error'),
      issues,
      validatedArtifactCount: artifacts.size(),
    };
  }
}

/** Default rule: no artifact may embed a raw secret value. */
export const noRawSecretsRule: ArtifactValidationRule = {
  id: 'no-raw-secrets',
  validate(artifacts) {
    const issues: ArtifactValidationIssue[] = [];
    for (const artifact of artifacts.all()) {
      try {
        const parsed = JSON.parse(artifact.content) as unknown;
        if (isSecretReference(parsed)) continue;
      } catch {
        /* not JSON */
      }
      if (/sk-[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{20,}|secret:\/\/\S+/.test(artifact.content)) {
        issues.push({
          path: artifact.path,
          severity: 'warning',
          message: 'artifact content contains a credential-shaped value',
          code: 'credential-shape',
        });
      }
    }
    return issues;
  },
};
