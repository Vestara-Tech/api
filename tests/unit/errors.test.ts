import { strict as assert } from 'node:assert';
import test from 'node:test';
import { VestaraError, badRequest, internalError, notFound } from '../../src/core/errors.js';

test('VestaraError defaults map code to status and retryable', () => {
  const err = new VestaraError({ code: 'NOT_FOUND', message: 'missing' });
  assert.equal(err.status, 404);
  assert.equal(err.retryable, false);
});

test('badRequest helper produces a 400', () => {
  const err = badRequest('nope', { field: 'x' });
  assert.equal(err.code, 'BAD_REQUEST');
  assert.equal(err.status, 400);
  assert.deepEqual(err.details, { field: 'x' });
});

test('internalError produces a 500 with message', () => {
  const err = internalError('boom');
  assert.equal(err.status, 500);
  assert.equal(err.message, 'boom');
});

test('SERVICE_UNAVAILABLE is retryable', () => {
  const err = new VestaraError({ code: 'SERVICE_UNAVAILABLE', message: 'down' });
  assert.equal(err.retryable, true);
});

test('notFound helper', () => {
  const err = notFound('gone');
  assert.equal(err.status, 404);
  assert.equal(err.code, 'NOT_FOUND');
});
