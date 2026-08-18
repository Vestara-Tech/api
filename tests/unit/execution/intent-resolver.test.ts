import { describe, expect, it } from 'vitest';
import { IntentResolver } from '../../../src/execution/index.js';

describe('IntentResolver', () => {
  it('resolves the Theme Builder request into a complex build intent', () => {
    const intent = new IntentResolver().resolve('Build the Theme Builder');
    expect(intent.kind).toBe('build');
    expect(intent.target).toBe('Theme Builder');
    expect(intent.complexity).toBe('complex');
    expect(intent.confidence).toBeGreaterThan(0.9);
    expect(intent.requiredCapabilities).toEqual(expect.arrayContaining(['components', 'themes', 'templates', 'workflows', 'tasks', 'generator', 'verification']));
  });

  it('surfaces ambiguity when the goal is empty', () => {
    const intent = new IntentResolver().resolve('   ');
    expect(intent.ambiguities).toHaveLength(1);
    expect(intent.ambiguities[0]?.code).toBe('EMPTY_GOAL');
  });
});
