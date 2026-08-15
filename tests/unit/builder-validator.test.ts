import { describe, expect, it } from 'vitest';
import { DefinitionValidator } from '../../src/builder/domain/validator.js';
import { makeProductDefinition } from '../helpers/definition.js';

const validator = new DefinitionValidator();

describe('DefinitionValidator', () => {
  it('accepts a valid definition', () => {
    const result = validator.validate(makeProductDefinition());
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects a non-semver version', () => {
    const result = validator.validate(makeProductDefinition({ version: 'latest' }));
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.path === 'version')).toBe(true);
  });

  it('rejects duplicate resource field names', () => {
    const definition = makeProductDefinition();
    const product = definition.resources[0]!;
    definition.resources = [
      {
        ...product,
        fields: [...product.fields, { id: 'dup', name: 'name', type: 'string' }],
      },
    ];
    const result = validator.validate(definition);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('duplicate field name'))).toBe(true);
  });

  it('rejects an enum field without enumValues', () => {
    const definition = makeProductDefinition();
    const product = definition.resources[0]!;
    definition.resources = [
      { ...product, fields: [...product.fields, { id: 'cat', name: 'category', type: 'enum' }] },
    ];
    const result = validator.validate(definition);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('enum field requires enumValues'))).toBe(true);
  });

  it('rejects a relation to a missing resource', () => {
    const definition = makeProductDefinition();
    const product = definition.resources[0]!;
    definition.resources = [
      {
        ...product,
        relations: [{ id: 'rel', name: 'owner', kind: 'many-to-one', targetResource: 'User' }],
      },
    ];
    const result = validator.validate(definition);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('relation target resource "User" does not exist'))).toBe(true);
  });

  it('accepts a relation to a resource declared later in the list', () => {
    const definition = makeProductDefinition();
    const product = definition.resources[0]!;
    definition.resources = [
      {
        ...product,
        relations: [{ id: 'rel', name: 'category', kind: 'many-to-one', targetResource: 'Category' }],
      },
      { id: 'cat_res', name: 'Category', plural: 'categories', fields: [] },
    ];
    const result = validator.validate(definition);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects a path parameter not present in the path', () => {
    const definition = makeProductDefinition();
    definition.endpoints = [
      ...definition.endpoints,
      {
        id: 'ep3',
        method: 'GET',
        path: '/products/list',
        parameters: [{ id: 'p1', name: 'id', in: 'path', type: 'uuid', required: true }],
      },
    ];
    const result = validator.validate(definition);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('path parameter :id not present'))).toBe(true);
  });

  it('rejects duplicate endpoints', () => {
    const definition = makeProductDefinition();
    definition.endpoints = [
      ...definition.endpoints,
      { id: 'dup', method: 'GET', path: '/products', summary: 'duplicate' },
    ];
    const result = validator.validate(definition);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.message.includes('duplicate endpoint'))).toBe(true);
  });
});
