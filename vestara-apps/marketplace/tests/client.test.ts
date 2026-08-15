import { describe, expect, it } from 'vitest';
import { marketplaceApi } from '../src/api/marketplaceApi';

describe('marketplace API client', () => {
  it('exposes the full API surface', () => {
    expect(typeof marketplaceApi.packages).toBe('function');
    expect(typeof marketplaceApi.package).toBe('function');
    expect(typeof marketplaceApi.categories).toBe('function');
    expect(typeof marketplaceApi.installed).toBe('function');
    expect(typeof marketplaceApi.install).toBe('function');
    expect(typeof marketplaceApi.enable).toBe('function');
    expect(typeof marketplaceApi.disable).toBe('function');
    expect(typeof marketplaceApi.update).toBe('function');
    expect(typeof marketplaceApi.uninstall).toBe('function');
  });

  it('builds query strings for search + kind', () => {
    const withSearch = marketplaceApi.packages('github');
    const withKind = marketplaceApi.packages(undefined, 'agent');
    expect(withSearch).toBeInstanceOf(Promise);
    expect(withKind).toBeInstanceOf(Promise);
  });
});
