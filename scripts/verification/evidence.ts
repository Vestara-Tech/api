import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { REPO_ROOT } from './affected.ts';
import type { GraphIssue } from './graph/types.ts';
import { ENGINE_VERSION } from './fingerprint.ts';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const EVIDENCE_ROOT = join(REPO_ROOT, '.vestara', 'evidence');
export const EVIDENCE_DIR = join(EVIDENCE_ROOT, 'verification');
export const TELEMETRY_DIR = join(EVIDENCE_ROOT, 'telemetry');

export interface ToolchainInfo {
  node: string;
  engine: string;
  vitest: string;
}

export interface Evidence {
  fingerprint: string;
  level: string;
  scope: string;
  modules: string[];
  tests: string[];
  result: 'pass' | 'fail';
  durationMs: number;
  createdAt: string;
  toolchain: ToolchainInfo;
}

export type VerificationResult = 'pass' | 'fail' | 'indeterminate';

export interface VerificationReport {
  version: 1;
  level: string;
  scope: string;
  changedFiles: string[];
  affectedModules: string[];
  selectedTests: string[];
  executedTests: string[];
  reusedTests: string[];
  skippedTests: string[];
  passed: number;
  failed: number;
  cached: number;
  escalated: boolean;
  escalationReasons: string[];
  durationMs: number;
  graphValid: boolean;
  graphIssues: readonly GraphIssue[];
  result: VerificationResult;
  verified: boolean;
  evidence: string | null;
}

export interface TelemetryEntry {
  ts: string;
  level: string;
  scope: string;
  changed: number;
  selected: number;
  executed: number;
  cached: number;
  escalated: boolean;
  durationMs: number;
  result: VerificationResult;
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function sanitizeFingerprint(fingerprint: string): string {
  return fingerprint.replace(/[^a-zA-Z0-9_.-]/g, '-');
}

export function evidencePath(fingerprint: string): string {
  return join(EVIDENCE_DIR, `${sanitizeFingerprint(fingerprint)}.json`);
}

export function readVitestVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'node_modules', 'vitest', 'package.json'), 'utf8')) as {
      version?: string;
    };
    return pkg.version ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export function currentToolchain(): ToolchainInfo {
  return { node: process.version, engine: ENGINE_VERSION, vitest: readVitestVersion() };
}

export function saveEvidence(evidence: Evidence): void {
  ensureDir(EVIDENCE_DIR);
  writeFileSync(evidencePath(evidence.fingerprint), JSON.stringify(evidence, null, 2), 'utf8');
}

export function loadEvidence(fingerprint: string): Evidence | null {
  const path = evidencePath(fingerprint);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as Evidence;
  } catch {
    return null;
  }
}

export function writeReport(report: VerificationReport): string {
  ensureDir(EVIDENCE_DIR);
  const path = join(EVIDENCE_DIR, 'latest.json');
  writeFileSync(path, JSON.stringify(report, null, 2), 'utf8');
  return path;
}

export function appendTelemetry(entry: TelemetryEntry): void {
  ensureDir(TELEMETRY_DIR);
  const path = join(TELEMETRY_DIR, 'verification.jsonl');
  writeFileSync(path, `${JSON.stringify(entry)}\n`, { encoding: 'utf8', flag: 'a' });
}

export function readTelemetry(): TelemetryEntry[] {
  const path = join(TELEMETRY_DIR, 'verification.jsonl');
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf8').split('\n').filter(Boolean);
  const entries: TelemetryEntry[] = [];
  for (const line of lines) {
    try {
      entries.push(JSON.parse(line) as TelemetryEntry);
    } catch {
      // skip malformed lines
    }
  }
  return entries;
}
