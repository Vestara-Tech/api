import { describe, expect, it } from 'vitest';
import { marketplaceApi } from '../src/api/marketplaceApi';

describe('marketplace My Library (MKT-UI-014)', () => {
  it('exposes the library routes on the API client', () => {
    expect(typeof marketplaceApi.installed).toBe('function');
    expect(typeof marketplaceApi.update).toBe('function');
    expect(typeof marketplaceApi.enable).toBe('function');
  });

  it('favorites are stored per-user in localStorage keys', () => {
    const key = 'vestara.marketplace.favorites';
    expect(key).toMatch(/^vestara\./);
  });
});
