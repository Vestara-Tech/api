export type RecoveryDestination = 'recovery' | 'slot-a' | 'slot-b';

export interface RecoveryBootRequest {
  readonly destination: RecoveryDestination;
  readonly reason?: string;
}

/** SYS-012 — Recovery boot control through a governed capability. */
export interface RecoveryBootControl {
  scheduleBoot(request: RecoveryBootRequest): Promise<{ scheduled: boolean; destination: RecoveryDestination }>;
}

export type PowerAction = 'reboot' | 'shutdown';

export interface PowerControlRequest {
  readonly action: PowerAction;
  readonly reason?: string;
}

/** SYS-013 — Power management through a governed capability. */
export interface PowerControl {
  request(request: PowerControlRequest): Promise<{ accepted: boolean; action: PowerAction }>;
}
