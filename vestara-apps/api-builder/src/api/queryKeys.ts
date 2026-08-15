export const queryKeys = {
  definitions: {
    all: ['definitions'] as const,
    list: (query: object) => ['definitions', 'list', query] as const,
    detail: (id: string) => ['definitions', 'detail', id] as const,
    preview: (id: string) => ['definitions', 'preview', id] as const,
    revisions: (id: string) => ['definitions', 'revisions', id] as const,
  },
};
