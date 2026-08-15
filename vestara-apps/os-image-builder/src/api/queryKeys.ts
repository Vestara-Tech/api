export const queryKeys = {
  image: {
    all: ['image'] as const,
    profiles: ['image', 'profiles'] as const,
    profile: (id: string) => ['image', 'profile', id] as const,
    plan: (id: string, target: string) => ['image', 'plan', id, target] as const,
    state: ['image', 'state'] as const,
  },
};
