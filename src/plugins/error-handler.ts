import type { FastifyInstance } from 'fastify';
import { VestaraError, internalError, notFound } from '../core/errors.js';

interface FastifyErrorLike {
  statusCode?: number;
}

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const errLike = error as FastifyErrorLike;
    const statusCode = errLike?.statusCode;
    const isClientError = typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500;
    const normalized = error instanceof VestaraError ? error : internalError();
    const requestId = request.ctx?.requestId ?? '';
    const correlationId = request.ctx?.correlationId ?? '';

    if (!(error instanceof VestaraError)) {
      request.log.error({ err: error }, 'http.request.failed');
    }

    const status = isClientError ? statusCode : normalized.status;
    const code = isClientError ? 'BAD_REQUEST' : normalized.code;
    const message = error instanceof Error ? error.message : normalized.message;

    reply.status(status).send({
      error: {
        code,
        message,
        requestId,
        correlationId,
        retryable: false,
        details: {},
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
