import type { LogQuery, LogQueryStats, LogRecord } from '../contracts.js';

/** LOG-007 — LogStore contract. Storage is abstracted (in-memory, JSONL, Postgres, Loki). */
export interface LogStore {
  append(record: LogRecord): void;
  appendBatch(records: readonly LogRecord[]): void;
  query(query: LogQuery): readonly LogRecord[];
  tail(limit: number): readonly LogRecord[];
  count(): number;
  deleteBefore(timestamp: string): number;
  aggregate(query: LogQuery): LogQueryStats;
}
