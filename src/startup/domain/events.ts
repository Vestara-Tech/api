import type { VestaraEvent } from '../../core/events.js';

export type StartupEventType = 'startup.transition' | 'startup.ready' | 'startup.degraded' | 'startup.failed' | 'startup.service';

export interface StartupEventPayload {
  readonly [key: string]: unknown;
}

export function makeStartupEvent(
  type: StartupEventType,
  payload: StartupEventPayload,
  correlationId?: string,
): VestaraEvent {
  return {
    type,
    category: 'domain',
    occurredAt: new Date().toISOString(),
    payload,
    ...(correlationId !== undefined ? { correlationId } : {}),
  };
}
