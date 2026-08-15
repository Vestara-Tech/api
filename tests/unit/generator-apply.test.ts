import { describe, expect, it } from 'vitest';
import { ArtifactSet } from '../../src/generator/artifacts/artifact-set.js';
import { buildPreview } from '../../src/generator/preview/preview.js';
import { ArtifactValidationPipeline, assertSafePath, noRawSecretsRule } from '../../src/generator/validation/pipeline.js';
import { governedApply, verifyApply } from '../../src/generator/apply/apply.js';
import { diffToLines } from '../../src/generator/domain/builder-contracts.js';

function memoryReader(files: Record<string, string>) {
  return {
    async read(path: string) {
      return files[path] ?? null;
    },
    async exists(path: string) {
      return path in files;
    },
  };
}

describe('preview + diff (GEN-007)', () => {
  it('classifies create / update / unchanged / remove-eligible files', async () => {
    const artifacts = new ArtifactSet('gen', '1.0.0');
    artifacts.add({ path: 'new.txt', content: 'new' });
    artifacts.add({ path: 'same.txt', content: 'same' });
    artifacts.add({ path: 'changed.txt', content: 'changed content' });

    const preview = await buildPreview({
      generatorId: 'gen',
      generatorVersion: '1.0.0',
      artifacts,
      reader: memoryReader({ 'same.txt': 'same', 'changed.txt': 'old content' }),
      previewHash: 'h',
    });

    expect(preview.additions).toBe(1);
    expect(preview.changes).toBe(1);
    const byPath = new Map(preview.diff.map((d) => [d.path, d.operation]));
    expect(byPath.get('new.txt')).toBe('create');
    expect(byPath.get('same.txt')).toBe('unchanged');
    expect(byPath.get('changed.txt')).toBe('update');
  });

  it('diffToLines produces builder-friendly lines', async () => {
    const artifacts = new ArtifactSet('gen', '1.0.0');
    artifacts.add({ path: 'a.ts', content: 'x' });
    const preview = await buildPreview({
      generatorId: 'gen',
      generatorVersion: '1.0.0',
      artifacts,
      reader: memoryReader({}),
      previewHash: 'h',
    });
    const lines = diffToLines(preview.diff);
    expect(lines[0]).toMatchObject({ path: 'a.ts', operation: 'create', unchanged: false });
  });
});

describe('validation pipeline (GEN-008)', () => {
  it('rejects unsafe artifact paths', () => {
    expect(() => assertSafePath('src/a.ts')).not.toThrow();
    expect(() => assertSafePath('../escape.ts')).toThrow();
    expect(() => assertSafePath('/abs.ts')).toThrow();
  });

  it('flags missing required files and oversized sets', () => {
    const artifacts = new ArtifactSet('gen', '1.0.0');
    artifacts.add({ path: 'a.ts', content: 'x' });
    const pipeline = new ArtifactValidationPipeline([], { requiredFiles: ['index.ts'], maxFileCount: 2 });
    const result = pipeline.validate(artifacts);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'missing-required')).toBe(true);
  });

  it('noRawSecretsRule warns on credential-shaped content', () => {
    const artifacts = new ArtifactSet('gen', '1.0.0');
    artifacts.add({ path: 'config.ts', content: 'export const key = "sk-abcdefghijklmnop";' });
    const issues = noRawSecretsRule.validate(artifacts);
    expect(issues.some((i) => i.code === 'credential-shape')).toBe(true);
  });
});

describe('governed apply + verify (GEN-009/010)', () => {
  it('applies only when approved', async () => {
    const artifacts = new ArtifactSet('gen', '1.0.0');
    artifacts.add({ path: 'a.txt', content: 'a' });
    const written = new Map<string, string>();
    const port = {
      async write(path: string, content: string) {
        written.set(path, content);
      },
      async exists(path: string) {
        return written.has(path);
      },
    };
    await expect(governedApply(artifacts, { applyPort: port, approved: false })).rejects.toThrow(/approved/i);
    const result = await governedApply(artifacts, { applyPort: port, approved: true });
    expect(result.appliedFiles).toEqual(['a.txt']);
    expect(written.get('a.txt')).toBe('a');
  });

  it('verifies applied files', async () => {
    const artifacts = new ArtifactSet('gen', '1.0.0');
    artifacts.add({ path: 'a.txt', content: 'a' });
    const written = new Map([['a.txt', 'a']]);
    const port = {
      async write(path: string, content: string) {
        written.set(path, content);
      },
      async exists(path: string) {
        return written.has(path);
      },
    };
    const verification = await verifyApply(artifacts, port);
    expect(verification.verified).toBe(true);
    expect(verification.checks).toHaveLength(1);
  });
});
