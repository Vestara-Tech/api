import type { FastifyInstance } from 'fastify';
import { VestaraError, internalError, notFound } from '../core/errors.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const normalized = error instanceof VestaraError ? error : internalError();
    const requestId = request.ctx?.requestId ?? '';
    const correlationId = request.ctx?.correlationId ?? '';

    if (!(error instanceof VestaraError)) {
      request.log.error({ err: error }, 'http.request.failed');
    }

    reply.status(normalized.status).send({
      error: {
        code: normalized.code,
        message: normalized.message,
        requestId,
        correlationId,
        retryable: normalized.retryable,
        details: normalized.details,
      },
    });
  });

  app.setNotFoundHandler((request, reply) => {
    const err = notFound(`No route for ${request.method} ${request.url}`);
    reply.status(404).send({
      error: {
        code: err.code,
        message: err.message,
        requestId: request.ctx?.requestId ?? '',
        correlationId: request.ctx?.correlationId ?? '',
        retryable: err.retryable,
        details: err.details,
      },
    });
  });
}
