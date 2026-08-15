import { AsyncLocalStorage } from 'node:async_hooks';
import { newCorrelationId, newRequestId, newTraceId } from './identifiers.js';

export interface RequestContext {
  readonly requestId: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly actorId?: string | undefined;
  readonly organizationId?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly clientId?: string | undefined;
}

export interface RequestContextInit {
  readonly actorId?: string | undefined;
  readonly organizationId?: string | undefined;
  readonly workspaceId?: string | undefined;
  readonly clientId?: string | undefined;
  readonly correlationId?: string | undefined;
  readonly requestId?: string | undefined;
}

export function createRequestContext(init: RequestContextInit = {}): RequestContext {
  return {
    requestId: init.requestId ?? newRequestId(),
    correlationId: init.correlationId ?? newCorrelationId(),
    traceId: newTraceId(),
    actorId: init.actorId,
    organizationId: init.organizationId,
    workspaceId: init.workspaceId,
    clientId: init.clientId,
  };
}

class RequestContextStore {
  private readonly storage = new AsyncLocalStorage<RequestContext>();

  run<T>(context: RequestContext, fn: () => Promise<T>): Promise<T>;
  run<T>(context: RequestContext, fn: () => T): T;
  run<T>(context: RequestContext, fn: () => T | Promise<T>): T | Promise<T> {
    return this.storage.run(context, fn);
  }

  current(): RequestContext | null {
    return this.storage.getStore() ?? null;
  }

  requireCurrent(): RequestContext {
    const current = this.storage.getStore();
    if (!current) throw new Error('RequestContext is not established');
    return current;
  }
}

export const requestContextStore = new RequestContextStore();
