import type { FastifyInstance } from 'fastify';
import type { RequestContext } from '../core/context.js';
import { createRequestContext, requestContextStore } from '../core/context.js';
import { newRequestId } from '../core/identifiers.js';

declare module 'fastify' {
  interface FastifyRequest {
    ctx: RequestContext;
  }
}

export function registerRequestContextPlugin(app: FastifyInstance): void {
  app.addHook('onRequest', async (request) => {
    const correlationId = request.headers['x-correlation-id'];
    const ctx = createRequestContext({
      requestId: newRequestId(),
      correlationId: typeof correlationId === 'string' && correlationId.length > 0 ? correlationId : undefined,
      actorId: headerString(request.headers['x-actor-id']),
      organizationId: headerString(request.headers['x-organization-id']),
      workspaceId: headerString(request.headers['x-workspace-id']),
      clientId: headerString(request.headers['x-client-id']),
    });
    request.ctx = ctx;
    request.log = request.log.child({
      requestId: ctx.requestId,
      correlationId: ctx.correlationId,
      traceId: ctx.traceId,
    });
  });

  app.addHook('onSend', async (request, reply, payload) => {
    // Set correlation headers on every response before it is serialized/sent.
    if (request.ctx) {
      reply.header('x-request-id', request.ctx.requestId);
      reply.header('x-correlation-id', request.ctx.correlationId);
      reply.header('x-trace-id', request.ctx.traceId);
      // Expose the request context to code paths outside Fastify's scope.
      await requestContextStore.run(request.ctx, async () => payload);
    }
    return payload;
  });

  app.addHook('onResponse', async (request, reply) => {
    const { ctx } = request;
    request.log.info(
      {
        method: request.method,
        route: request.routeOptions?.url ?? request.url,
        statusCode: reply.statusCode,
        durationMs: reply.elapsedTime,
      },
      'http.request.completed',
    );
  });
}

function headerString(value: string | string[] | undefined): string | undefined {
  if (typeof value === 'string' && value.length > 0) return value;
  return undefined;
}
