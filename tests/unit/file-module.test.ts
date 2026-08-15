import { describe, expect, it } from 'vitest';
import {
  FileService,
  MemoryProvider,
  WorkspaceSandbox,
  matchesPattern,
  type FileWorkspace,
} from '../../src/file/index.js';

function workspace(overrides: Partial<FileWorkspace> = {}): FileWorkspace {
  return {
    id: 'vestara-api',
    name: 'vestara-api',
    root: 'workspace://vestara-api/',
    providerId: 'memory',
    include: ['src/**', 'tests/**', 'docs/**'],
    exclude: ['.git/**', 'node_modules/**', '.env', 'secrets/**'],
    revision: 1,
    ...overrides,
  };
}

function buildService() {
  const provider = new MemoryProvider('memory');
  provider.seed('workspace://vestara-api/src/app.ts', 'export const app = 1;');
  provider.seed('workspace://vestara-api/src/auth/service.ts', 'export class AuthService {}');
  provider.seed('workspace://vestara-api/tests/app.test.ts', 'import { app } from "../src/app";');
  provider.seed('workspace://vestara-api/.env', 'SECRET=value');
  const service = new FileService({ providers: { memory: provider } });
  service.mountWorkspace(workspace());
  return { service, provider };
}

describe('WorkspaceSandbox', () => {
  it('resolves workspace-namespaced paths', () => {
    const sandbox = new WorkspaceSandbox(workspace());
    expect(sandbox.resolve('src/app.ts')).toBe('workspace://vestara-api/src/app.ts');
    expect(sandbox.resolve('workspace://vestara-api/src/x.ts')).toBe('workspace://vestara-api/src/x.ts');
  });

  it('rejects paths escaping the workspace', () => {
    const sandbox = new WorkspaceSandbox(workspace());
    expect(() => sandbox.resolve('/etc/passwd')).toThrow(/escapes workspace/);
    expect(() => sandbox.resolve('workspace://other/src/x.ts')).toThrow(/another workspace/);
  });

  it('enforces include/exclude patterns', () => {
    const sandbox = new WorkspaceSandbox(workspace());
    expect(sandbox.isAllowed('src/app.ts')).toBe(true);
    expect(sandbox.isAllowed('docs/guide.md')).toBe(true);
    expect(sandbox.isAllowed('node_modules/pkg/index.js')).toBe(false);
    expect(sandbox.isAllowed('.env')).toBe(false);
    expect(sandbox.isAllowed('secrets/key.pem')).toBe(false);
    expect(sandbox.isAllowed('lib/unknown.ts')).toBe(false);
  });
});

describe('matchesPattern', () => {
  it('supports glob-lite patterns', () => {
    expect(matchesPattern('src/app.ts', 'src/**')).toBe(true);
    expect(matchesPattern('src/deep/nested/app.ts', 'src/**')).toBe(true);
    expect(matchesPattern('.env', '.env')).toBe(true);
    expect(matchesPattern('secrets/key.pem', 'secrets/**')).toBe(true);
  });
});

describe('FileService read/list/search', () => {
  it('reads files within the sandbox', async () => {
    const { service } = buildService();
    const result = await service.read('vestara-api', 'src/app.ts');
    expect(result.content).toContain('export const app');
  });

  it('lists directory contents', async () => {
    const { service } = buildService();
    const resources = await service.list('vestara-api', 'src');
    expect(resources.map((r) => r.name)).toContain('app.ts');
    expect(resources.map((r) => r.name)).toContain('auth');
  });

  it('searches file names', async () => {
    const { service } = buildService();
    const results = await service.search('vestara-api', { pattern: 'auth' });
    expect(results.length).toBeGreaterThan(0);
  });

  it('rejects reads of excluded paths', async () => {
    const { service } = buildService();
    await expect(service.read('vestara-api', '.env')).rejects.toThrow(/excluded/);
  });
});

describe('FileService transactions (Generate != Write)', () => {
  it('creates, previews, applies and versions a multi-file transaction', async () => {
    const { service } = buildService();
    const transaction = service.createTransaction('vestara-api', [
      { id: 'o1', kind: 'create', path: 'src/new.ts', content: 'export const n = 1;' },
      { id: 'o2', kind: 'update', path: 'src/app.ts', content: 'export const app = 2;' },
    ]);
    expect(transaction.status).toBe('draft');

    const validated = service.validateTransaction(transaction.id);
    expect(validated.status).toBe('validated');

    const preview = service.previewTransaction(transaction.id);
    expect(preview.preview).toHaveLength(2);

    const applied = await service.applyTransaction(transaction.id);
    expect(applied.status).toBe('applied');

    const read = await service.read('vestara-api', 'src/new.ts');
    expect(read.content).toBe('export const n = 1;');

    const versions = service.versions('vestara-api', 'src/new.ts');
    expect(versions).toHaveLength(1);
    expect(versions[0]!.currentHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rolls back an applied transaction', async () => {
    const { service, provider } = buildService();
    const before = await service.read('vestara-api', 'src/app.ts');
    const transaction = service.createTransaction('vestara-api', [
      { id: 'o1', kind: 'update', path: 'src/app.ts', content: 'export const app = 999;' },
    ]);
    await service.applyTransaction(transaction.id);
    expect((await service.read('vestara-api', 'src/app.ts')).content).toContain('999');

    await service.rollbackTransaction(transaction.id);
    const after = await service.read('vestara-api', 'src/app.ts');
    expect(after.content).toBe(before.content);
  });

  it('rejects a transaction that writes an excluded path', () => {
    const { service } = buildService();
    expect(() =>
      service.createTransaction('vestara-api', [{ id: 'o1', kind: 'update', path: '.env', content: 'x' }]),
    ).toThrow(/excluded/);
  });

  it('emits file events', async () => {
    const { service } = buildService();
    const transaction = service.createTransaction('vestara-api', [
      { id: 'o1', kind: 'create', path: 'src/x.ts', content: 'x' },
    ]);
    await service.applyTransaction(transaction.id);
    const events = service.events();
    expect(events.some((e) => e.type === 'file.transaction.applied')).toBe(true);
  });
});
