import type { RequestContext } from './context.js';

export interface Query {
  readonly name: string;
  readonly input: unknown;
}

export interface QueryResult<T = unknown> {
  readonly ok: true;
  readonly name: string;
  readonly data: T;
}

export type QueryHandler<T = unknown> = (query: Query, ctx: RequestContext) => Promise<T>;

export class QueryBus {
  private readonly handlers = new Map<string, QueryHandler>();

  register(name: string, handler: QueryHandler): void {
    this.handlers.set(name, handler);
  }

  has(name: string): boolean {
    return this.handlers.has(name);
  }

  async ask<T = unknown>(query: Query, ctx: RequestContext): Promise<QueryResult<T>> {
    const handler = this.handlers.get(query.name);
    if (!handler) throw new Error(`No query handler registered for "${query.name}"`);
    const data = (await handler(query, ctx)) as T;
    return { ok: true, name: query.name, data };
  }

  registeredNames(): readonly string[] {
    return [...this.handlers.keys()].sort();
  }
}
