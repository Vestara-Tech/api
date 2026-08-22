/**
 * ARX-CP2 ARX-013 — Execution Inspector v2 contracts.
 *
 * The inspector READS projections and referenced detail resources; it
 * never becomes another source of execution state. The recovered
 * ActivityExecutionProjection stays cheap; this view is a moderate
 * composition over it plus lazy references to detail resources that are
 * fetched only when a tab is opened.
 */

import type {
  ActivityExecutionComplexity,
  ActivityExecutionStatus,
  ActivityParticipantProjection,
  DeveloperExecutionPhase,
} from '../projection/contracts.js';
import type { ActivityVerificationConclusion } from '../browse/contracts.js';

// ── Overview ───────────────────────────────────────────────────────

export interface ActivityInspectorOverview {
  readonly executionId: string;
  readonly goal: string;
  readonly status: ActivityExecutionStatus;
  readonly phase: DeveloperExecutionPhase;
  readonly complexity: ActivityExecutionComplexity;
  readonly participants: readonly ActivityParticipantProjection[];
  readonly workflowId?: string | undefined;
  readonly workflowRunId?: string | undefined;
  readonly startedAt?: string | undefined;
  readonly updatedAt: string;
  readonly completedAt?: string | undefined;
}

// ── Runtime ────────────────────────────────────────────────────────

export interface ActivityInspectorRuntime {
  readonly runtimeId?: string | undefined;
  readonly provider?: string | undefined;
  readonly model?: string | undefined;
  readonly sessionId?: string | undefined;
  readonly health: 'connected' | 'unknown' | 'unavailable';
}

// ── Context ────────────────────────────────────────────────────────

/** Selected context categories + resolved skills/resources (no giant prompt). */
export interface ActivityInspectorContext {
  readonly categories: readonly string[];
  readonly skills: readonly {
    readonly id: string;
    readonly version?: string | undefined;
  }[];
  readonly resourceCount: number;
  readonly provenance: readonly string[];
  readonly budget?: {
    readonly used: number;
    readonly limit?: number | undefined;
  } | undefined;
}

// ── Changes ────────────────────────────────────────────────────────

export interface ActivityInspectorFileEntry {
  readonly path: string;
  readonly status: string;
  readonly additions?: number | undefined;
  readonly deletions?: number | undefined;
}

export interface ActivityInspectorChanges {
  readonly fileCount: number;
  readonly files: readonly ActivityInspectorFileEntry[];
}

// ── Verification ───────────────────────────────────────────────────

export interface ActivityInspectorVerification {
  readonly status: 'pending' | 'running' | 'passed' | 'failed' | 'indeterminate';
  readonly conclusion?: ActivityVerificationConclusion | undefined;
  readonly freshness?: 'current' | 'stale' | undefined;
  readonly level?: string | undefined;
  readonly selectedTests: number;
  readonly executedTests: number;
  readonly cached: number;
  readonly fingerprint?: string | undefined;
  readonly reasons: readonly string[];
  readonly handoffEligible: boolean;
}

// ── Evidence ───────────────────────────────────────────────────────

export interface ActivityInspectorEvidence {
  readonly status: 'pending' | 'recorded';
  readonly hash?: string | undefined;
  readonly outcome?: string | undefined;
  readonly recordedAt?: string | undefined;
}

// ── Timeline ───────────────────────────────────────────────────────

export interface ActivityInspectorTimelineEntry {
  readonly sequence: number;
  readonly type: string;
  readonly title: string;
  readonly detail?: string | undefined;
  readonly at: string;
}

// ── Top-Level Inspector View ───────────────────────────────────────

export interface ActivityInspectorView {
  readonly executionId: string;
  readonly goal: string;
  readonly overview: ActivityInspectorOverview;
  readonly runtime: ActivityInspectorRuntime;
  readonly context: ActivityInspectorContext;
  readonly changes: ActivityInspectorChanges;
  readonly verification: ActivityInspectorVerification;
  readonly evidence: ActivityInspectorEvidence;
  readonly timeline: readonly ActivityInspectorTimelineEntry[];
}

// ── Lazy Detail Resources ──────────────────────────────────────────

/** Immutable CP5 evidence, resolved only when the Evidence tab opens. */
export interface ActivityInspectorEvidenceDetail {
  readonly schemaVersion: 1;
  readonly outcome: string;
  readonly execution: {
    readonly executionId: string;
    readonly agentRunId: string;
    readonly objective?: string | undefined;
  };
  readonly agent: {
    readonly id: string;
    readonly role: string;
  };
  readonly runtime: {
    readonly id: string;
    readonly version?: string | undefined;
    readonly sessionId?: string | undefined;
  };
  readonly model?: {
    readonly providerId?: string | undefined;
    readonly modelId?: string | undefined;
  } | undefined;
  readonly repository: {
    readonly baselineSha?: string | undefined;
    readonly headSha?: string | undefined;
    readonly changedFiles?: readonly string[] | undefined;
  };
  readonly skills: readonly {
    readonly id: string;
    readonly version?: string | undefined;
  }[];
  readonly tools: readonly {
    readonly id: string;
    readonly granted: boolean;
    readonly used: boolean;
  }[];
  readonly verification: {
    readonly purpose: string;
    readonly conclusion: 'pass' | 'fail' | 'indeterminate';
    readonly freshness: 'current' | 'stale';
    readonly fingerprint?: string | undefined;
  };
  readonly timing: {
    readonly startedAt: string;
    readonly completedAt: string;
  };
  readonly evidenceHash: string;
}

/** Full verification report, resolved by fingerprint on demand. */
export interface ActivityInspectorVerificationDetail {
  readonly fingerprint: string;
  readonly level: string;
  readonly scope: string;
  readonly result: 'pass' | 'fail' | 'indeterminate';
  readonly selectedTests: readonly string[];
  readonly executedTests: readonly string[];
  readonly cached: number;
  readonly failed: number;
  readonly durationMs: number;
  readonly graphValid: boolean;
  readonly evidence: string | null;
}

/** File-level diff, resolved on demand per changed file. */
export interface ActivityInspectorFileDiff {
  readonly path: string;
  readonly status: string;
  readonly additions: number;
  readonly deletions: number;
  readonly hunks: readonly {
    readonly header: string;
    readonly lines: readonly {
      readonly type: 'add' | 'delete' | 'context';
      readonly text: string;
    }[];
  }[];
}