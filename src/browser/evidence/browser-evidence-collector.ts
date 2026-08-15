import { randomId } from '../../core/identifiers.js';
import type { BrowserActionEvidence } from '../contracts.js';

/**
 * BRW-007 — Evidence collector. Every meaningful browser action emits
 * evidence (screenshots, url/action trail, extracted data, result) consumable
 * by the Verifier — completion isn't trusted because an agent says so.
 */
export class BrowserEvidenceCollector {
  private readonly records: BrowserActionEvidence[] = [];

  record(input: Omit<BrowserActionEvidence, 'timestamp'>): BrowserActionEvidence {
    const record: BrowserActionEvidence = { ...input, timestamp: new Date().toISOString() };
    this.records.push(record);
    return record;
  }

  list(sessionId?: string): readonly BrowserActionEvidence[] {
    const all = [...this.records].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return sessionId !== undefined ? all.filter((r) => r.sessionId === sessionId) : all;
  }

  listByTask(taskId: string): readonly BrowserActionEvidence[] {
    return this.list().filter((r) => r.taskId === taskId);
  }
}

export function evidenceId(): string {
  return randomId('evid');
}
