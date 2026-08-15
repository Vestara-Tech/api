import { describe, expect, it } from 'vitest';
import { ArtifactSet, createArtifact } from '../../src/generator/artifacts/artifact-set.js';
import { createGenerationPlan, isPlanSatisfied } from '../../src/generator/domain/plan.js';
import { hashOf, stableStringify } from '../../src/generator/domain/hash.js';
import { InMemoryTemplateRegistry, substitutionRenderer } from '../../src/generator/templates/template-registry.js';

describe('artifact model (GEN-005)', () => {
  it('creates artifacts with content hashes', () => {
    const artifact = createArtifact({ path: 'src/index.ts', content: 'export const x = 1;' });
    expect(artifact.contentHash).toMatch(/^[a-f0-9]{64}$/);
    expect(artifact.encoding).toBe('utf8');
  });

  it('rejects duplicate artifact paths in a set', () => {
    const set = new ArtifactSet('gen', '1.0.0');
    set.add({ path: 'a.txt', content: 'a' });
    expect(() => set.add({ path: 'a.txt', content: 'b' })).toThrow();
  });

  it('computes a deterministic output hash independent of insertion order', () => {
    const a = new ArtifactSet('gen', '1.0.0');
    a.add({ path: 'a.txt', content: 'a' });
    a.add({ path: 'b.txt', content: 'b' });
    const b = new ArtifactSet('gen', '1.0.0');
    b.add({ path: 'b.txt', content: 'b' });
    b.add({ path: 'a.txt', content: 'a' });
    expect(a.outputHash()).toBe(b.outputHash());
  });

  it('output hash changes when content changes', () => {
    const a = new ArtifactSet('gen', '1.0.0');
    a.add({ path: 'a.txt', content: 'a' });
    const b = new ArtifactSet('gen', '1.0.0');
    b.add({ path: 'a.txt', content: 'different' });
    expect(a.outputHash()).not.toBe(b.outputHash());
  });
});

describe('generation plan (GEN-003)', () => {
  it('builds a plan with deterministic planHash', () => {
    const plan = createGenerationPlan({
      id: 'plan-1',
      generatorId: 'generator.api.typescript',
      inputHash: hashOf({ apiName: 'Products' }),
      steps: [{ id: 'render', kind: 'render', description: 'render' }],
      requirements: [{ id: 'r1', label: 'name', satisfied: true }],
    });
    expect(plan.planHash).toMatch(/^[a-f0-9]{64}$/);
    expect(isPlanSatisfied(plan)).toBe(true);
  });

  it('marks plans with unsatisfied requirements', () => {
    const plan = createGenerationPlan({
      id: 'plan-2',
      generatorId: 'gen',
      inputHash: hashOf({}),
      steps: [],
      requirements: [{ id: 'r1', label: 'x', satisfied: false }],
    });
    expect(isPlanSatisfied(plan)).toBe(false);
  });
});

describe('template platform (GEN-004)', () => {
  it('registers and retrieves template versions', () => {
    const registry = new InMemoryTemplateRegistry();
    registry.register({ id: 't', version: '1.0.0', source: 'hello' });
    registry.register({ id: 't', version: '2.0.0', source: 'hello2' });
    expect(registry.get('t')?.version).toBe('2.0.0');
    expect(registry.getVersion('t', '1.0.0')?.source).toBe('hello');
    expect(registry.list()).toHaveLength(2);
  });

  it('renders {{ }} substitutions deterministically', () => {
    const rendered = substitutionRenderer(
      { id: 't', version: '1.0.0', source: 'port={{ config.port }} name={{ apiName }}' },
      { values: { config: { port: 4310 }, apiName: 'Products' } },
    );
    expect(rendered).toBe('port=4310 name=Products');
  });
});

describe('determinism hash (GEN-006)', () => {
  it('stableStringify is order-independent', () => {
    expect(stableStringify({ b: 1, a: 2 })).toBe(stableStringify({ a: 2, b: 1 }));
  });

  it('hashOf is stable', () => {
    expect(hashOf({ x: [1, 2, 3] })).toBe(hashOf({ x: [1, 2, 3] }));
    expect(hashOf({ x: [1, 2, 3] })).not.toBe(hashOf({ x: [1, 3, 2] }));
  });
});
