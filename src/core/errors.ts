export type VestaraErrorCode =
  | 'INTERNAL_ERROR'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'OPERATION_FAILED'
  | 'OPERATION_NOT_FOUND'
  | 'SERVICE_UNAVAILABLE'
  | 'BAD_REQUEST';

export interface VestaraErrorContext {
  readonly [key: string]: unknown;
}

/**
 * Canonical error shape for the Vestara API v2 control plane.
 * Every thrown error is normalized into this type before it leaves a boundary.
 */
export class VestaraError extends Error {
  readonly code: VestaraErrorCode;
  readonly status: number;
  readonly retryable: boolean;
  readonly details: VestaraErrorContext;
  override readonly cause?: unknown;
  readonly requestId?: string;
  readonly correlationId?: string;

  constructor(opts: {
    code: VestaraErrorCode;
    message: string;
    status?: number;
    retryable?: boolean;
    details?: VestaraErrorContext;
    cause?: unknown;
    requestId?: string;
    correlationId?: string;
  }) {
    super(opts.message);
    this.name = 'VestaraError';
    this.code = opts.code;
    this.status = opts.status ?? defaultStatusFor(opts.code);
    this.retryable = opts.retryable ?? defaultRetryableFor(opts.code);
    this.details = opts.details ?? {};
    if (opts.cause !== undefined) this.cause = opts.cause;
    if (opts.requestId !== undefined) this.requestId = opts.requestId;
    if (opts.correlationId !== undefined) this.correlationId = opts.correlationId;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function internalError(message = 'Internal error', opts?: Partial<Omit<ConstructorParameters<typeof VestaraError>[0], 'code' | 'message'>>): VestaraError {
  return new VestaraError({ code: 'INTERNAL_ERROR', message, ...opts });
}

export function badRequest(message: string, details?: VestaraErrorContext): VestaraError {
  return new VestaraError({ code: 'BAD_REQUEST', message, ...(details !== undefined ? { details } : {}) });
}

export function conflict(message: string, details?: VestaraErrorContext): VestaraError {
  return new VestaraError({ code: 'CONFLICT', message, ...(details !== undefined ? { details } : {}) });
}

export function forbidden(message: string, details?: VestaraErrorContext): VestaraError {
  return new VestaraError({ code: 'FORBIDDEN', message, ...(details !== undefined ? { details } : {}) });
}

export function unauthorized(message: string, details?: VestaraErrorContext): VestaraError {
  return new VestaraError({ code: 'UNAUTHORIZED', message, ...(details !== undefined ? { details } : {}) });
}

export function notFound(message: string, details?: VestaraErrorContext): VestaraError {
  return new VestaraError({ code: 'NOT_FOUND', message, ...(details !== undefined ? { details } : {}) });
}

function defaultStatusFor(code: VestaraErrorCode): number {
  switch (code) {
    case 'VALIDATION_ERROR':
    case 'BAD_REQUEST':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'CONFLICT':
      return 409;
    case 'RATE_LIMITED':
      return 429;
    case 'INTERNAL_ERROR':
      return 500;
    case 'SERVICE_UNAVAILABLE':
      return 503;
    default:
      return 500;
  }
}

function defaultRetryableFor(code: VestaraErrorCode): boolean {
  switch (code) {
    case 'RATE_LIMITED':
    case 'SERVICE_UNAVAILABLE':
      return true;
    default:
      return false;
  }
}
