import { randomId } from '../../core/identifiers.js';
import type { LogLevel, LogQuery, LogQueryStats, LogRecord } from '../contracts.js';
import type { LogStore } from './log-store.js';

/** LOG-008 — In-memory LogStore (tests, ephemeral, small local deployments). */
export class InMemoryLogStore implements LogStore {
  private readonly records: LogRecord[] = [];

  append(record: LogRecord): void {
    this.records.push({ ...record, id: record.id || randomId('log') });
  }

  appendBatch(records: readonly LogRecord[]): void {
    for (const record of records) this.append(record);
  }

  query(query: LogQuery): readonly LogRecord[] {
    let items = this.records;
    if (query.level) {
      const levels = Array.isArray(query.level) ? query.level : [query.level];
      items = items.filter((r) => levels.includes(r.level));
    }
    if (query.sourceId) items = items.filter((r) => r.source.id === query.sourceId);
    if (query.sourceType) items = items.filter((r) => r.source.type === query.sourceType);
    if (query.correlationId) items = items.filter((r) => r.correlationId === query.correlationId);
    if (query.traceId) items = items.filter((r) => r.traceId === query.traceId);
    if (query.workflowId) items = items.filter((r) => r.workflowId === query.workflowId);
    if (query.agentId) items = items.filter((r) => r.agentId === query.agentId);
    if (query.messageContains) {
      const needle = query.messageContains.toLowerCase();
      items = items.filter((r) => r.message.toLowerCase().includes(needle));
    }
    if (query.since) items = items.filter((r) => r.timestamp >= query.since!);
    if (query.until) items = items.filter((r) => r.timestamp <= query.until!);
    const sorted = [...items].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return query.limit !== undefined ? sorted.slice(0, query.limit) : sorted;
  }

  tail(limit: number): readonly LogRecord[] {
    return this.query({ limit });
  }

  count(): number {
    return this.records.length;
  }

  deleteBefore(timestamp: string): number {
    const before = this.records.length;
    const remaining = this.records.filter((r) => r.timestamp >= timestamp);
    this.records.length = 0;
    this.records.push(...remaining);
    return before - remaining.length;
  }

  aggregate(query: LogQuery): LogQueryStats {
    const matched = this.query(query);
    const byLevel = { trace: 0, debug: 0, info: 0, warn: 0, error: 0, fatal: 0 } as Record<LogLevel, number>;
    const bySource: Record<string, number> = {};
    for (const record of matched) {
      byLevel[record.level] += 1;
      bySource[record.source.id] = (bySource[record.source.id] ?? 0) + 1;
    }
    return { total: matched.length, byLevel, bySource };
  }
}
