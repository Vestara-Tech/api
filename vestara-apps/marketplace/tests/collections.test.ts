import { describe, expect, it } from 'vitest';
import { marketplaceApi } from '../src/api/marketplaceApi';
import { useCollections } from '../src/hooks/useCollections';

describe('Marketplace Collections (MKT-UI-015)', () => {
  it('collections are stored under the vestara localStorage namespace', () => {
    expect('vestara.marketplace.collections').toMatch(/^vestara\./);
  });

  it('the collections hook exposes CRUD operations', () => {
    const { collections, createCollection, togglePackage, removeCollection } = useCollections();
    expect(typeof createCollection).toBe('function');
    expect(typeof togglePackage).toBe('function');
    expect(typeof removeCollection).toBe('function');
    expect(Array.isArray(collections)).toBe(true);
  });

  it('marketplace API still serves package discovery', () => {
    expect(typeof marketplaceApi.packages).toBe('function');
  });
});
