export const queryKeys = {
  marketplace: {
    all: ['marketplace'] as const,
    contributions: ['marketplace', 'contributions'] as const,
    provides: (kind: string) => ['marketplace', 'provides', kind] as const,
    bundles: ['marketplace', 'bundles'] as const,
    distributions: ['marketplace', 'distributions'] as const,
    plan: (id: string) => ['marketplace', 'plan', id] as const,
    published: ['marketplace', 'published'] as const,
    publishers: ['marketplace', 'publishers'] as const,
    versions: (packageId: string) => ['marketplace', 'versions', packageId] as const,
  },
};
