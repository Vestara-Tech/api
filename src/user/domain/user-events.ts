/** USR-008 — User events. */

export type UserEventType =
  | 'user.created'
  | 'user.activated'
  | 'user.suspended'
  | 'user.disabled'
  | 'user.deleted'
  | 'user.profile.updated'
  | 'user.preferences.updated'
  | 'user.membership.added'
  | 'user.membership.removed';

export interface UserEvent {
  readonly type: UserEventType;
  readonly userId: string;
  readonly occurredAt: string;
  readonly payload: Readonly<Record<string, unknown>>;
}
