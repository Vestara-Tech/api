import { describe, expect, it } from 'vitest';
import { pluralize, fieldTypeLabel, FIELD_TYPES } from '../src/types/domain';

describe('pluralize', () => {
  it('pluralizes regular names', () => {
    expect(pluralize('Product')).toBe('Products');
    expect(pluralize('Order')).toBe('Orders');
  });

  it('handles -y endings', () => {
    expect(pluralize('Category')).toBe('Categories');
  });

  it('handles names already ending in s', () => {
    expect(pluralize('Status')).toBe('Status');
  });
});

describe('fieldTypeLabel', () => {
  it('maps known types to labels', () => {
    expect(fieldTypeLabel('string')).toBe('String');
    expect(fieldTypeLabel('date-time')).toBe('Date-Time');
  });

  it('falls back to the raw type', () => {
    expect(fieldTypeLabel('unknown')).toBe('unknown');
  });
});

describe('FIELD_TYPES catalog', () => {
  it('covers the backend ApiFieldType domain union', () => {
    const values = FIELD_TYPES.map((f) => f.value);
    for (const expected of [
      'string', 'text', 'number', 'integer', 'boolean', 'uuid', 'email',
      'url', 'date', 'date-time', 'json', 'enum', 'relation',
    ]) {
      expect(values).toContain(expected);
    }
  });
});
