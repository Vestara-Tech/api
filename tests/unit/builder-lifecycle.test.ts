import { describe, expect, it } from 'vitest';
import { canTransition, isTerminal, transition } from '../../src/builder/domain/lifecycle.js';
import { VestaraError } from '../../src/core/errors.js';

describe('builder lifecycle', () => {
  it('allows the happy-path chain draft→validating→ready→publishing→published', () => {
    expect(canTransition('draft', 'validating')).toBe(true);
    expect(canTransition('validating', 'ready')).toBe(true);
    expect(canTransition('ready', 'publishing')).toBe(true);
    expect(canTransition('publishing', 'published')).toBe(true);
    expect(transition('draft', 'validating')).toBe('validating');
  });

  it('routes invalid validation back to draft', () => {
    expect(canTransition('validating', 'draft')).toBe(true);
    expect(canTransition('validating', 'ready')).toBe(true);
  });

  it('allows publishing failure to fall back to draft', () => {
    expect(canTransition('publishing', 'draft')).toBe(true);
  });

  it('allows published to be superseded and superseded to be re-published', () => {
    expect(canTransition('published', 'superseded')).toBe(true);
    expect(canTransition('superseded', 'publishing')).toBe(true);
  });

  it('rejects illegal transitions', () => {
    expect(canTransition('draft', 'published')).toBe(false);
    expect(() => transition('draft', 'published')).toThrow(VestaraError);
    expect(() => transition('ready', 'draft')).toThrow(VestaraError);
  });

  it('marks published and superseded as terminal', () => {
    expect(isTerminal('published')).toBe(true);
    expect(isTerminal('superseded')).toBe(true);
    expect(isTerminal('draft')).toBe(false);
  });
});
