/** OS-039 — OS events. */

import type { OsLifecycleState } from './os-state.js';

export type OsEventType =
  | 'os.discovered'
  | 'os.lifecycle.changed'
  | 'os.diff.computed'
  | 'os.plan.created'
  | 'os.plan.approved'
  | 'os.plan.applied'
  | 'os.plan.failed'
  | 'os.package.installed'
  | 'os.package.removed'
  | 'os.update.applied'
  | 'os.rollback.started'
  | 'os.rollback.completed';

export interface OsEvent {
  readonly type: OsEventType;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
}
