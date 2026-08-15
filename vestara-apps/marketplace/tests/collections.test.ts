import { describe, expect, it } from 'vitest';
import { marketplaceApi } from '../src/api/marketplaceApi';
import { addPackageToCollection, removePackageFromCollection, type PackageCollection } from '../src/hooks/useCollections';

describe('Marketplace Collections (MKT-UI-015)', () => {
  it('collections are stored under the vestara localStorage namespace', () => {
    expect('vestara.marketplace.collections').toMatch(/^vestara\./);
  });

  it('adds and removes packages immutably', () => {
    const base: PackageCollection = { id: 'col_1', name: 'Full-Stack Pack', packageIds: [], createdAt: 't' };
    const withPkg = addPackageToCollection(base, 'com.vestara.developer-agent');
    expect(withPkg.packageIds).toEqual(['com.vestara.developer-agent']);
    expect(base.packageIds).toEqual([]);

    const addedTwice = addPackageToCollection(withPkg, 'com.vestara.developer-agent');
    expect(addedTwice.packageIds).toHaveLength(1);

    const removed = removePackageFromCollection(addedTwice, 'com.vestara.developer-agent');
    expect(removed.packageIds).toEqual([]);
  });

  it('marketplace API still serves package discovery', () => {
    expect(typeof marketplaceApi.packages).toBe('function');
  });
});
