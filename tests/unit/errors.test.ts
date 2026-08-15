import { describe, expect, it } from 'vitest';
import { VestaraError, badRequest, internalError, notFound } from '../../src/core/errors.js';

describe('VestaraError', () => {
  it('defaults map code to status and retryable', () => {
    const err = new VestaraError({ code: 'NOT_FOUND', message: 'missing' });
    expect(err.status).toBe(404);
    expect(err.retryable).toBe(false);
  });

  it('badRequest helper produces a 400', () => {
    const err = badRequest('nope', { field: 'x' });
    expect(err.code).toBe('BAD_REQUEST');
    expect(err.status).toBe(400);
    expect(err.details).toEqual({ field: 'x' });
  });

  it('internalError produces a 500 with message', () => {
    const err = internalError('boom');
    expect(err.status).toBe(500);
    expect(err.message).toBe('boom');
  });

  it('SERVICE_UNAVAILABLE is retryable', () => {
    const err = new VestaraError({ code: 'SERVICE_UNAVAILABLE', message: 'down' });
    expect(err.retryable).toBe(true);
  });

  it('notFound helper', () => {
    const err = notFound('gone');
    expect(err.status).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
  });
});
