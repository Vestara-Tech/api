/**
 * ARX-CP2 ARX-012 — Execution browser.
 *
 * Exploits the durable Activity history (ARX-011): applies bounded,
 * cursor-based queries over persisted facts and returns lightweight
 * summaries. Pagination uses the stable sort basis (updatedAt,
 * executionId) encoded as an opaque cursor — safe against new records
 * arriving mid-traversal and against duplicate/overlap pages.
 */

import { hashOf } from '../../generator/domain/hash.js';
import type {
  ActivityExecutionStatus,
} from '../projection/contracts.js';
import type {
  ActivityExecutionFact,
  ActivityHistoryStore,
} from '../history/contracts.js';
import type {
  ActivityExecutionSummary,
  ActivityHistoryPage,
  ActivityHistoryQuery,
  ActivityHistoryCursor,
  ActivityVerificationConclusion,
} from './contracts.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export interface ActivityBrowser {
  browse(query: ActivityHistoryQuery): ActivityHistoryPage;
}

export class ActivityBrowserImpl implements ActivityBrowser {
  constructor(private readonly store: ActivityHistoryStore) {}

  browse(query: ActivityHistoryQuery): ActivityHistoryPage {
    const facts = this.store.listExecutions(query.roomId);
    const filtered = facts.filter((fact) => this.matches(fact, query));

    const sort: 'newest' | 'oldest' = query.sort ?? 'newest';
    const sorted = filtered.sort((left, right) =>
      this.compare(left, right, sort),
    );

    const limit = clampLimit(query.limit);
    const cursor = decodeCursor(query.cursor);
    const cursorIndex =
      cursor === undefined
        ? undefined
        : sorted.findIndex(
            (fact) =>
              fact.updatedAt === cursor.updatedAt &&
              fact.executionId === cursor.executionId,
          );

    // Cursor not found (stale/expired): fall back to the beginning.
    // A valid cursor resumes AFTER the referenced item so pages do not
    // re-emit the cursor's own record.
    const fromIndex = cursorIndex !== undefined && cursorIndex >= 0 ? cursorIndex + 1 : 0;
    const items = sorted.slice(fromIndex, fromIndex + limit);
    const lastItem = items.length > 0 ? items[items.length - 1] : undefined;
    const hasMore = fromIndex + items.length < sorted.length;

    return {
      items: items.map((fact) => this.toSummary(fact)),
      ...(hasMore && lastItem !== undefined
        ? {
            nextCursor: encodeCursor({
              updatedAt: lastItem.updatedAt,
              executionId: lastItem.executionId,
            }),
          }
        : {}),
      hasMore,
    };
  }

  private matches(fact: ActivityExecutionFact, query: ActivityHistoryQuery): boolean {
    if (query.goal !== undefined && !fact.goal.toLowerCase().includes(query.goal.trim().toLowerCase())) return false;
    if (query.status !== undefined && query.status.length > 0 && !query.status.includes(fact.status)) return false;
    if (query.complexity !== undefined && query.complexity.length > 0 && !query.complexity.includes(fact.complexity)) return false;
    if (query.agentId !== undefined && fact.agentId !== query.agentId) return false;
    if (query.workflowId !== undefined && fact.workflowId !== query.workflowId) return false;
    if (query.from !== undefined && fact.updatedAt < query.from) return false;
    if (query.to !== undefined && fact.updatedAt > query.to) return false;

    if (query.verification !== undefined && query.verification.length > 0) {
      const conclusion = this.verificationConclusion(fact);
      if (!query.verification.includes(conclusion)) return false;
    }

    return true;
  }

  private verificationConclusion(fact: ActivityExecutionFact): ActivityVerificationConclusion {
    if (fact.status === 'completed') {
      return fact.verificationFingerprint !== undefined ? 'pass' : 'indeterminate';
    }
    if (fact.status === 'failed') return 'fail';
    if (fact.status === 'verifying') return 'indeterminate';
    return 'pending';
  }

  private toSummary(fact: ActivityExecutionFact): ActivityExecutionSummary {
    const changedFileCount = this.store
      .events(fact.executionId)
      .filter((event) => event.type === 'file-changed').length;
    return {
      executionId: fact.executionId,
      goal: fact.goal,
      complexity: fact.complexity,
      status: fact.status,
      participants: fact.participants.map((participant) => participant.agentId),
      verification: {
        conclusion: this.verificationConclusion(fact),
        handoffEligible: fact.status === 'completed' && fact.verificationFingerprint !== undefined,
      },
      changedFileCount,
      startedAt: fact.startedAt ?? fact.updatedAt,
      updatedAt: fact.updatedAt,
    };
  }

  private compare(left: ActivityExecutionFact, right: ActivityExecutionFact, sort: 'newest' | 'oldest'): number {
    const timeOrder = left.updatedAt.localeCompare(right.updatedAt) || left.executionId.localeCompare(right.executionId);
    return sort === 'newest' ? -timeOrder : timeOrder;
  }
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT;
  return Math.min(Math.max(1, Math.floor(limit)), MAX_LIMIT);
}

function encodeCursor(cursor: ActivityHistoryCursor): string {
  return `cur_${hashOf(cursor).slice(0, 24)}_${Buffer.from(JSON.stringify(cursor)).toString('base64url')}`;
}

function decodeCursor(cursor: string | undefined): ActivityHistoryCursor | undefined {
  if (cursor === undefined) return undefined;
  const parts = cursor.split('_');
  const encoded = parts[parts.length - 1];
  if (!encoded) return undefined;
  try {
    const raw = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as unknown;
    if (
      raw &&
      typeof raw === 'object' &&
      typeof (raw as ActivityHistoryCursor).updatedAt === 'string' &&
      typeof (raw as ActivityHistoryCursor).executionId === 'string'
    ) {
      return raw as ActivityHistoryCursor;
    }
  } catch {
    // Malformed cursor — treat as absent (browse from start).
  }
  return undefined;
}