import { useCallback, useState } from 'react';

export interface PackageCollection {
  readonly id: string;
  readonly name: string;
  readonly packageIds: readonly string[];
  readonly createdAt: string;
}

const COLLECTIONS_KEY = 'vestara.marketplace.collections';

function readCollections(): PackageCollection[] {
  try {
    if (typeof localStorage === 'undefined') return [];
    return JSON.parse(localStorage.getItem(COLLECTIONS_KEY) ?? '[]') as PackageCollection[];
  } catch {
    return [];
  }
}

export function useCollections() {
  const [collections, setCollections] = useState<readonly PackageCollection[]>(readCollections());

  const persist = useCallback((next: readonly PackageCollection[]) => {
    setCollections(next);
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(next));
  }, []);

  const createCollection = useCallback(
    (name: string) => {
      const existing = readCollections();
      const next: PackageCollection = { id: `col_${Date.now().toString(36)}`, name, packageIds: [], createdAt: new Date().toISOString() };
      persist([...existing, next]);
      return next;
    },
    [persist],
  );

  const togglePackage = useCallback(
    (collectionId: string, packageId: string) => {
      const existing = readCollections();
      const next = existing.map((c) =>
        c.id === collectionId
          ? { ...c, packageIds: c.packageIds.includes(packageId) ? c.packageIds.filter((p) => p !== packageId) : [...c.packageIds, packageId] }
          : c,
      );
      persist(next);
    },
    [persist],
  );

  const removeCollection = useCallback(
    (collectionId: string) => persist(readCollections().filter((c) => c.id !== collectionId)),
    [persist],
  );

  return { collections, createCollection, togglePackage, removeCollection };
}
