/** IMG-031 — Profile lifecycle. Published revisions are immutable. */

export type ImageProfileLifecycleStatus =
  | 'draft'
  | 'validating'
  | 'ready'
  | 'building'
  | 'verified'
  | 'published'
  | 'deprecated';

export interface ImageProfileLifecycle {
  readonly id: string;
  readonly status: ImageProfileLifecycleStatus;
  readonly currentRevision: number;
  readonly revisions: readonly number[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt?: string;
}

export type ImageProfileTransition =
  | 'validate'
  | 'approve'
  | 'start-build'
  | 'verify'
  | 'publish'
  | 'deprecate'
  | 'reopen';

const TRANSITIONS: Record<ImageProfileLifecycleStatus, readonly ImageProfileTransition[]> = {
  draft: ['validate', 'deprecate'],
  validating: ['approve', 'reopen'],
  ready: ['start-build', 'validate', 'publish', 'deprecate'],
  building: ['verify', 'reopen'],
  verified: ['publish', 'start-build', 'reopen'],
  published: ['deprecate'],
  deprecated: ['reopen'],
};

export function canTransition(from: ImageProfileLifecycleStatus, transition: ImageProfileTransition): boolean {
  return TRANSITIONS[from].includes(transition);
}

export function nextStatus(from: ImageProfileLifecycleStatus, transition: ImageProfileTransition): ImageProfileLifecycleStatus {
  if (!canTransition(from, transition)) {
    throw new Error(`Invalid transition "${transition}" from "${from}"`);
  }
  switch (transition) {
    case 'validate':
      return 'validating';
    case 'approve':
      return 'ready';
    case 'start-build':
      return 'building';
    case 'verify':
      return 'verified';
    case 'publish':
      return 'published';
    case 'deprecate':
      return 'deprecated';
    case 'reopen':
      return 'draft';
  }
}

export function initialLifecycle(id: string): ImageProfileLifecycle {
  const now = new Date().toISOString();
  return { id, status: 'draft', currentRevision: 1, revisions: [1], createdAt: now, updatedAt: now };
}

export function advanceLifecycle(current: ImageProfileLifecycle, transition: ImageProfileTransition): ImageProfileLifecycle {
  const now = new Date().toISOString();
  const status = nextStatus(current.status, transition);
  const revision = transition === 'validate' ? current.currentRevision + 1 : current.currentRevision;
  return {
    ...current,
    status,
    currentRevision: revision,
    revisions: revision > current.currentRevision ? [...current.revisions, revision] : current.revisions,
    updatedAt: now,
    ...(status === 'published' ? { publishedAt: now } : {}),
  };
}
