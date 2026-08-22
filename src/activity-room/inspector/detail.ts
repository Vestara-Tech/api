/**
 * ARX-CP2 ARX-013 — Lazy inspector detail resolvers.
 *
 * The inspector view stays cheap; these resolve full detail resources
 * only when a tab is opened, by reference id:
 *   - Evidence by immutable CP5 hash.
 *   - Verification report by fingerprint.
 *   - File diff per changed path.
 *
 * None of these write state — they read referenced resources.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { CodingExecutionEvidence, CodingExecutionEvidenceStore } from '../../car/evidence/contracts.js';
import type { ActivityInspectorEvidenceDetail, ActivityInspectorFileDiff, ActivityInspectorVerificationDetail } from './contracts.js';
import type { ActivityInspectorSource } from './inspector.js';

/** Resolve the immutable CP5 evidence by hash. Null when not persisted. */
export async function resolveEvidenceDetail(
  evidenceStore: CodingExecutionEvidenceStore,
  evidenceHash: string,
): Promise<ActivityInspectorEvidenceDetail | null> {
  const evidence = await evidenceStore.get(evidenceHash);
  if (!evidence) return null;
  return toEvidenceDetail(evidence);
}

function toEvidenceDetail(evidence: CodingExecutionEvidence): ActivityInspectorEvidenceDetail {
  return {
    schemaVersion: 1,
    outcome: evidence.outcome,
    execution: {
      executionId: evidence.execution.executionId,
      agentRunId: evidence.execution.agentRunId,
      ...(evidence.execution.objective !== undefined ? { objective: evidence.execution.objective } : {}),
    },
    agent: { id: evidence.agent.id, role: evidence.agent.role },
    runtime: {
      id: evidence.runtime.id,
      ...(evidence.runtime.version !== undefined ? { version: evidence.runtime.version } : {}),
      ...(evidence.runtime.sessionId !== undefined ? { sessionId: evidence.runtime.sessionId } : {}),
    },
    ...(evidence.model !== undefined
      ? {
          model: {
            ...(evidence.model.providerId !== undefined ? { providerId: evidence.model.providerId } : {}),
            ...(evidence.model.modelId !== undefined ? { modelId: evidence.model.modelId } : {}),
          },
        }
      : {}),
    repository: {
      ...(evidence.repository.baselineSha !== undefined ? { baselineSha: evidence.repository.baselineSha } : {}),
      ...(evidence.repository.headSha !== undefined ? { headSha: evidence.repository.headSha } : {}),
      ...(evidence.repository.changedFiles !== undefined ? { changedFiles: evidence.repository.changedFiles } : {}),
    },
    skills: evidence.skills.map((skill) => ({
      id: skill.id,
      ...(skill.version !== undefined ? { version: skill.version } : {}),
    })),
    tools: evidence.tools.map((tool) => ({ id: tool.id, granted: tool.granted, used: tool.used })),
    verification: {
      purpose: evidence.verification.purpose,
      conclusion: evidence.verification.conclusion,
      freshness: evidence.verification.freshness,
      ...(evidence.verification.fingerprint !== undefined ? { fingerprint: evidence.verification.fingerprint } : {}),
    },
    timing: {
      startedAt: evidence.timing.startedAt,
      completedAt: evidence.timing.completedAt,
    },
    evidenceHash: evidence.evidenceHash,
  };
}

/**
 * Resolve a verification report snapshot by fingerprint from the
 * verification evidence directory. Null when not found.
 */
export function resolveVerificationDetail(
  fingerprint: string,
  options: { repoRoot?: string } = {},
): ActivityInspectorVerificationDetail | null {
  const root = options.repoRoot ?? process.cwd();
  const dir = join(root, '.vestara', 'evidence', 'verification');
  if (!existsSync(dir)) return null;

  // Fingerprint may be a bare sha256:... or already include the prefix.
  const target = fingerprint.startsWith('sha256-') ? fingerprint : fingerprint.replace(/^sha256:/, 'sha256-');
  const path = join(dir, `${target}.json`);
  if (!existsSync(path)) return null;

  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
    const report = raw as {
      level?: unknown;
      scope?: unknown;
      result?: unknown;
      selectedTests?: unknown;
      executedTests?: unknown;
      cached?: unknown;
      failed?: unknown;
      durationMs?: unknown;
      graphValid?: unknown;
      evidence?: unknown;
    };
    return {
      fingerprint,
      level: String(report.level ?? ''),
      scope: String(report.scope ?? ''),
      result: report.result === 'pass' || report.result === 'fail' ? report.result : 'indeterminate',
      selectedTests: toArray(report.selectedTests),
      executedTests: toArray(report.executedTests),
      cached: toNumber(report.cached),
      failed: toNumber(report.failed),
      durationMs: toNumber(report.durationMs),
      graphValid: report.graphValid === true,
      evidence: typeof report.evidence === 'string' ? report.evidence : null,
    };
  } catch {
    return null;
  }
}

function toArray(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
}

/**
 * Resolve a file-level diff on demand.
 *
 * The source projection only persists paths + status (kept cheap); hunks
 * are resolved here when a persisted detail resource exists. Without one
 * the caller receives a summary-only entry (additions/deletions 0, no
 * hunks) — the file entry itself, not a fabricated diff.
 */
export function resolveFileDiff(
  source: ActivityInspectorSource,
  path: string,
): ActivityInspectorFileDiff | null {
  const file = source.projection.changes.files.find((entry) => entry.path === path);
  if (!file) return null;

  return {
    path: file.path,
    status: file.status,
    additions: file.additions ?? 0,
    deletions: file.deletions ?? 0,
    hunks: [],
  };
}