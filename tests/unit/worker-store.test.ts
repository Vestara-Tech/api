import { describe, expect, it } from 'vitest';
import { InMemoryJobStore, JobLifecycle, type Job } from '../../src/worker/index.js';

describe('WKR-002 lifecycle', () => {
  it('enforces the standard job transition policy', () => {
    const lifecycle = JobLifecycle.standard();
    expect(lifecycle.transition('pending', 'running')).toBe('running');
    expect(lifecycle.transition('running', 'retrying')).toBe('retrying');
    expect(lifecycle.transition('retrying', 'running')).toBe('running');
    expect(lifecycle.transition('running', 'completed')).toBe('completed');
    expect(() => lifecycle.transition('pending', 'completed')).toThrow(/Invalid job transition/);
    expect(() => lifecycle.transition('cancelled', 'running')).toThrow(/Invalid job transition/);
  });

  it('recognizes terminal states', () => {
    const lifecycle = JobLifecycle.standard();
    expect(lifecycle.canTransition('running', 'failed')).toBe(true);
    expect(lifecycle.canTransition('completed', 'running')).toBe(false);
  });
});

describe('WKR-003 in-memory job store', () => {
  function buildStore(): InMemoryJobStore {
    return new InMemoryJobStore();
  }

  function jobPayload(id: string): { readonly id: string } {
    return { id };
  }

  it('enqueues jobs with stable defaults', () => {
    const store = buildStore();
    const job = store.enqueue({ type: 'system.health-check', payload: jobPayload('A') });

    expect(job.status).toBe('pending');
    expect(job.source).toBe('manual');
    expect(job.attempts).toBe(0);
    expect(job.maxAttempts).toBeGreaterThan(0);
    expect(job.metadata).toEqual({});
    expect(store.get(job.id).id).toBe(job.id);
  });

  it('claims only one job across concurrent pollers', async () => {
    const store = buildStore();
    const job = store.enqueue({ type: 'worker.cleanup', payload: jobPayload('B') });

    const results = await Promise.all([
      Promise.resolve().then(() => store.claim(['pending'])),
      Promise.resolve().then(() => store.claim(['pending'])),
      Promise.resolve().then(() => store.claim(['pending'])),
    ]);

    const claimed = results.filter((value): value is Job => value !== null);
    expect(claimed).toHaveLength(1);
    expect(claimed[0]!.id).toBe(job.id);
    expect(claimed[0]!.status).toBe('running');
    expect(claimed[0]!.attempts).toBe(1);
    expect(store.count({ status: 'running' })).toBe(1);
  });

  it('reclaims retrying jobs only when they are due', () => {
    const store = buildStore();
    const job = store.enqueue({
      type: 'diagnostics.run',
      payload: jobPayload('C'),
      availableAt: new Date(Date.now() - 1_000).toISOString(),
    });

    const running = store.claim(['pending']);
    expect(running?.id).toBe(job.id);
    expect(running?.status).toBe('running');

    const retryAtFuture = new Date(Date.now() + 60_000).toISOString();
    const retried = store.retry(job.id, retryAtFuture, { code: 'DIAG_TIMEOUT', message: 'diagnostics timed out' });
    expect(retried.status).toBe('retrying');
    expect(store.claim(['pending'])).toBeNull();

    const dueJob = store.retry(job.id, new Date(Date.now() - 1_000).toISOString());
    expect(dueJob.status).toBe('retrying');
    const reclaimed = store.claim(['pending']);
    expect(reclaimed?.id).toBe(job.id);
    expect(reclaimed?.status).toBe('running');
    expect(reclaimed?.attempts).toBe(2);
  });

  it('completes, fails, cancels, and purges jobs with lifecycle validation', () => {
    const store = buildStore();
    const first = store.enqueue({ type: 'logs.rotation', payload: jobPayload('D') });
    const second = store.enqueue({ type: 'logs.rotation', payload: jobPayload('E') });

    const claimed = store.claim(['pending']);
    expect(claimed?.id).toBe(first.id);

    const finished = store.complete(first.id, { output: { rotated: true } });
    expect(finished.status).toBe('completed');
    expect(finished.completedAt).toBeTruthy();
    expect(finished.result).toEqual({ rotated: true });

    expect(() => store.complete(first.id)).toThrow(/Cannot complete job/);

    const secondClaimed = store.claim(['pending']);
    expect(secondClaimed?.id).toBe(second.id);

    const failed = store.complete(second.id, { error: { code: 'LOG_ROTATION_FAILED', message: 'rotation failed' } });
    expect(failed.status).toBe('failed');
    expect(failed.failedAt).toBeTruthy();

    const purged = store.purgeCompleted(new Date(Date.now() + 1_000).toISOString());
    expect(purged).toBe(1);
    expect(() => store.get(first.id)).toThrow(/not found/);
    expect(store.get(second.id).status).toBe('failed');

    const cancelledJob = store.enqueue({
      type: 'worker.cleanup',
      payload: jobPayload('F'),
      availableAt: new Date(Date.now() + 60_000).toISOString(),
    });
    const cancelled = store.cancel(cancelledJob.id, 'no longer needed');
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelReason).toBe('no longer needed');
    expect(() => store.complete(cancelledJob.id)).toThrow(/Cannot complete job/);
  });
});
