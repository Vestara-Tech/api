import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const contractsPath = resolve('vestara-apps', 'api-builder', 'src', 'api', 'contracts.ts');

describe('frontend contracts (generated from src/builder/contracts.ts)', () => {
  it('serializes method unions as literals, not unknown', async () => {
    const src = await readFile(contractsPath, 'utf8');
    expect(src).toContain('method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"');
  });

  it('serializes relation kind unions and optional relations/indexes on resources', async () => {
    const src = await readFile(contractsPath, 'utf8');
    expect(src).toContain('"one-to-one" | "one-to-many" | "many-to-one" | "many-to-many"');
    expect(src).toContain('readonly relations?:');
    expect(src).toContain('readonly indexes?:');
  });

  it('keeps fields readonly and marks optionals with ?', async () => {
    const src = await readFile(contractsPath, 'utf8');
    expect(src).toContain('readonly id: string;');
    expect(src).toContain('readonly enumValues?: readonly string[];');
    expect(src).toContain('readonly required?: boolean;');
  });

  it('exposes the preview contract shape consumed by the UI', async () => {
    const src = await readFile(contractsPath, 'utf8');
    expect(src).toContain('export interface PreviewResult');
    expect(src).toContain('readonly publishable: boolean;');
    expect(src).toContain('readonly classification: "compatible" | "breaking" | "unknown";');
  });

  it('exposes list, revision, and publish results', async () => {
    const src = await readFile(contractsPath, 'utf8');
    expect(src).toContain('export interface ListDefinitionsResult');
    expect(src).toContain('readonly nextCursor: string | null;');
    expect(src).toContain('export interface Revision');
    expect(src).toContain('export interface PublishResult');
  });

  it('regenerates deterministically (no drift against generator output)', async () => {
    const { spawnSync } = await import('node:child_process');
    const before = await readFile(contractsPath, 'utf8');
    const result = spawnSync('npx', ['tsx', 'scripts/generate-frontend-contracts.ts'], {
      encoding: 'utf8',
      cwd: resolve('.'),
    });
    expect(result.status).toBe(0);
    const after = await readFile(contractsPath, 'utf8');
    expect(after).toBe(before);
  });
});
