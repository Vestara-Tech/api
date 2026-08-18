/**
 * ARX-CP2 ARX-012 — Execution browser query contracts.
 *
 * Bounded, cursor-based browsing over the durable Activity history.
 * The UI never sees raw ActivityExecutionFact objects or internal
 * store positions; it receives lightweight summaries and an opaque
 * pagination cursor.
 */

import type {
  ActivityExecutionComplexity,
  ActivityExecutionStatus,
} from '../projection/contracts.js';

export type ActivityVerificationConclusion =
  | 'pass'
  | 'fail'
  | 'indeterminate'
  | 'pending';

export type ActivityBrowserSort = 'newest' | 'oldest';

/** Bounded, filterable browser query over durable history. */
export interface ActivityHistoryQuery {
  readonly roomId?: string | undefined;
  readonly goal?: string | undefined;
  readonly status?: readonly ActivityExecutionStatus[] | undefined;
  readonly complexity?: readonly ActivityExecutionComplexity[] | undefined;
  readonly agentId?: string | undefined;
  readonly workflowId?: string | undefined;
  readonly verification?: readonly ActivityVerificationConclusion[] | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly sort?: ActivityBrowserSort | undefined;
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
}

/**
 * Lightweight summary projection for the browser list.
 * Deliberately omits runtime/model/evidence hashes — those belong
 * in the inspector, reached via GET /history/:executionId.
 */
export interface ActivityExecutionSummary {
  readonly executionId: string;
  readonly goal: string;
  readonly complexity: ActivityExecutionComplexity;
  readonly status: ActivityExecutionStatus;
  readonly participants: readonly string[];
  readonly verification: {
    readonly conclusion: ActivityVerificationConclusion;
    readonly handoffEligible: boolean;
  };
  readonly changedFileCount: number;
  readonly startedAt: string;
  readonly updatedAt: string;
}

/** One page of browsing results with an opaque next cursor. */
export interface ActivityHistoryPage {
  readonly items: readonly ActivityExecutionSummary[];
  readonly nextCursor?: string | undefined;
  readonly hasMore: boolean;
}

/**
 * Opaque cursor encoding — clients must not interpret it.
 * Internally encodes the stable sort basis (updatedAt, executionId).
 */
export interface ActivityHistoryCursor {
  readonly updatedAt: string;
  readonly executionId: string;
}