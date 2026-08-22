/**
 * DEX-CP5 CAR-EVID-008 — File-backed coding execution evidence store.
 *
 * Persists immutable CodingExecutionEvidence keyed by evidence hash under
 * a local cache directory, surviving process restart. Read side is used
 * by the ARX-013 inspector's lazy evidence resolution; the hash is the
 * only address — evidence content is never rewritten.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  CodingExecutionEvidence,
  CodingExecutionEvidenceStore,
} from './contracts.js';

function fileNameFor(hash: string): string {
  return `${hash.replace(/[^a-zA-Z0-9:_-]/g, '_')}.json`;
}

export class FileCodingExecutionEvidenceStore implements CodingExecutionEvidenceStore {
  constructor(private readonly dir: string) {
    mkdirSync(this.dir, { recursive: true });
  }

  async save(evidence: CodingExecutionEvidence): Promise<void> {
    mkdirSync(this.dir, { recursive: true });
    writeFileSync(join(this.dir, fileNameFor(evidence.evidenceHash)), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  }

  async get(evidenceHash: string): Promise<CodingExecutionEvidence | null> {
    const path = join(this.dir, fileNameFor(evidenceHash));
    if (!existsSync(path)) return null;
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as CodingExecutionEvidence;
    } catch {
      return null;
    }
  }
}