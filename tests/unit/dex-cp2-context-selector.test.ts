import { describe, it, expect } from 'vitest';
import { selectContext } from '../../src/agent/context/context-selector.js';
import type { ExecutionContextItem } from '../../src/agent/context/execution-context.js';

function item(id: string, opts: Partial<ExecutionContextItem> = {}): ExecutionContextItem {
  return {
    id,
    source: 'agent-definition',
    layer: 'governance',
    required: false,
    priority: 50,
    content: `content for ${id}`,
    estimatedTokens: 10,
    provenance: { source: 'agent-definition', resolvedAt: '2026-01-01T00:00:00Z' },
    ...opts,
  };
}

describe('selectContext', () => {
  it('selects all items when within budget', () => {
    const items = [
      item('a', { estimatedTokens: 10, required: true }),
      item('b', { estimatedTokens: 10, required: false }),
    ];
    const result = selectContext(items, { budgetTokens: 100 });
    expect(result.selected).toHaveLength(2);
    expect(result.dropped).toHaveLength(0);
    expect(result.requiredDropped).toHaveLength(0);
  });

  it('drops optional items when budget is exceeded', () => {
    const items = [
      item('a', { estimatedTokens: 10, required: true }),
      item('b', { estimatedTokens: 50, required: false }),
      item('c', { estimatedTokens: 50, required: false }),
    ];
    const result = selectContext(items, { budgetTokens: 60 });
    expect(result.selected).toHaveLength(2); // a + one optional
    expect(result.dropped.length).toBeGreaterThanOrEqual(1);
  });

  it('never drops required items even when budget exceeded', () => {
    const items = [
      item('a', { estimatedTokens: 40, required: true }),
      item('b', { estimatedTokens: 40, required: true }),
      item('c', { estimatedTokens: 40, required: false }),
    ];
    const result = selectContext(items, { budgetTokens: 60 });
    // Both required items are selected despite exceeding budget.
    expect(result.selected.filter((i) => i.required)).toHaveLength(2);
    // Only 'b' overflows the budget (40+40=80 > 60), so only 'b' is in requiredDropped.
    expect(result.requiredDropped).toEqual(['b']);
    // Optional item is dropped.
    expect(result.dropped).toContain('c');
  });

  it('sorts by priority descending, then by id ascending', () => {
    const items = [
      item('z', { estimatedTokens: 5, priority: 10 }),
      item('a', { estimatedTokens: 5, priority: 50 }),
      item('m', { estimatedTokens: 5, priority: 30 }),
    ];
    const result = selectContext(items, { budgetTokens: 100 });
    expect(result.selected.map((i) => i.id)).toEqual(['a', 'm', 'z']);
  });

  it('required items come before optional items in selection', () => {
    const items = [
      item('opt-1', { estimatedTokens: 5, priority: 100, required: false }),
      item('req-1', { estimatedTokens: 5, priority: 10, required: true }),
    ];
    const result = selectContext(items, { budgetTokens: 100 });
    const reqIdx = result.selected.findIndex((i) => i.id === 'req-1');
    const optIdx = result.selected.findIndex((i) => i.id === 'opt-1');
    expect(reqIdx).toBeLessThan(optIdx);
  });

  it('metadata is correct', () => {
    const items = [
      item('a', { estimatedTokens: 20, required: true }),
      item('b', { estimatedTokens: 30, required: false }),
    ];
    const result = selectContext(items, { budgetTokens: 100 });
    expect(result.metadata.totalItems).toBe(2);
    expect(result.metadata.selectedItems).toBe(2);
    expect(result.metadata.totalEstimatedTokens).toBe(50);
    expect(result.metadata.budgetTokens).toBe(100);
    expect(result.metadata.resolvedAt).toBeTruthy();
  });

  it('handles empty items array', () => {
    const result = selectContext([], { budgetTokens: 100 });
    expect(result.selected).toHaveLength(0);
    expect(result.dropped).toHaveLength(0);
    expect(result.requiredDropped).toHaveLength(0);
    expect(result.metadata.totalItems).toBe(0);
  });

  it('deterministic: same inputs produce same outputs', () => {
    const items = [
      item('c', { estimatedTokens: 5, priority: 30 }),
      item('a', { estimatedTokens: 5, priority: 50 }),
      item('b', { estimatedTokens: 5, priority: 40 }),
    ];
    const r1 = selectContext(items, { budgetTokens: 100 });
    const r2 = selectContext(items, { budgetTokens: 100 });
    expect(r1.selected.map((i) => i.id)).toEqual(r2.selected.map((i) => i.id));
  });
});
