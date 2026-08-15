import type { FastifyInstance } from 'fastify';
import { context, propagation, SpanKind, trace } from '@opentelemetry/api';

const tracer = trace.getTracer('vestara-api');

export function registerTelemetry(app: FastifyInstance): void {
  app.addHook('onRequest', async (request) => {
    // Extract an incoming trace context (e.g. W3C traceparent) if present.
    const carrier: Record<string, string> = {};
    const traceparent = request.headers['traceparent'];
    const tracestate = request.headers['tracestate'];
    if (typeof traceparent === 'string') carrier.traceparent = traceparent;
    if (typeof tracestate === 'string') carrier.tracestate = tracestate;
    const extracted = propagation.extract(context.active(), carrier);

    const span = tracer.startSpan(`${request.method} ${request.url}`, {
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': request.method,
        'http.url': request.url,
        'http.target': request.url,
        'http.route': request.routeOptions?.url ?? request.url,
      },
    }, extracted);

    request.ctxSpan = span;
  });

  app.addHook('onResponse', async (request, reply) => {
    const span = request.ctxSpan;
    if (!span) return;
    span.setAttribute('http.status_code', reply.statusCode);
    span.end();
  });

  app.addHook('onError', async (request, _reply, error) => {
    const span = request.ctxSpan;
    if (!span) return;
    span.recordException(error);
    span.setAttribute('error', true);
  });
}

declare module 'fastify' {
  interface FastifyRequest {
    ctxSpan?: import('@opentelemetry/api').Span;
  }
}
