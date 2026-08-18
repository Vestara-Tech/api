import { describe, expect, it } from 'vitest';
import { InMemoryJobStore, RetryCalculator, WorkerLoop, WorkerService } from '../../src/worker/index.js';

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('WKR-004 retry calculator', () => {
  it('computes fixed and exponential delays with a cap', () => {
    const retry = new RetryCalculator();
    expect(retry.nextDelay('none', 1, 100)).toBeNull();
    expect(retry.nextDelay('fixed', 1, 100)).toBe(100);
    expect(retry.nextDelay('exponential', 1, 100)).toBe(100);
    expect(retry.nextDelay('exponential', 3, 100)).toBe(400);
    expect(retry.nextDelay('exponential', 5, 100, 250)).toBe(250);
  });
});

describe('WKR-005 worker loop', () => {
  it('respects the concurrency limit and runs jobs in parallel up to the limit', async () => {
    const store = new InMemoryJobStore();
    const loop = new WorkerLoop({ store, config: { concurrency: 2, pollIntervalMs: 50, retry: { policy: 'none', delayMs: 0, maxAttempts: 1, maxDelayMs: 0 } } });

    const releases: Array<ReturnType<typeof createDeferred<void>>> = [];
    let active = 0;
    let peak = 0;

    loop.registerHandler('worker.parallel', async () => {
      active += 1;
      peak = Math.max(peak, active);
      const gate = createDeferred<void>();
      releases.push(gate);
      await gate.promise;
      active -= 1;
      return 'ok';
    });

    store.enqueue({ type: 'worker.parallel', payload: { id: 'a' } });
    store.enqueue({ type: 'worker.parallel', payload: { id: 'b' } });
    store.enqueue({ type: 'worker.parallel', payload: { id: 'c' } });

    const tick = loop.tick();
    await sleep(10);
    expect(peak).toBe(2);
    expect(store.count({ status: 'running' })).toBe(2);
    expect(store.count({ status: 'pending' })).toBe(1);

    releases.shift()?.resolve();
    releases.shift()?.resolve();
    await tick;

    expect(store.count({ status: 'completed' })).toBe(2);
    expect(store.count({ status: 'pending' })).toBe(1);

    const secondTick = loop.tick();
    await sleep(10);
    expect(peak).toBe(2);
    releases.shift()?.resolve();
    await secondTick;
    expect(store.count({ status: 'completed' })).toBe(3);
  });

  it('retries failing jobs until the max attempts are exhausted', async () => {
    const store = new InMemoryJobStore({ config: { retry: { policy: 'fixed', delayMs: 1, maxAttempts: 3, maxDelayMs: 100 } } });
    const loop = new WorkerLoop({ store, config: { concurrency: 1, pollIntervalMs: 50, retry: { policy: 'fixed', delayMs: 1, maxAttempts: 3, maxDelayMs: 100 } } });

    let runs = 0;
    loop.registerHandler('worker.retry', async () => {
      runs += 1;
      if (runs < 3) throw new Error(`attempt ${runs}`);
      return { success: true };
    });

    const job = store.enqueue({ type: 'worker.retry', payload: { id: 'retry' } });

    await loop.tick();
    expect(store.get(job.id).status).toBe('retrying');
    expect(store.get(job.id).attempts).toBe(1);

    await sleep(5);
    await loop.tick();
    expect(store.get(job.id).status).toBe('retrying');
    expect(store.get(job.id).attempts).toBe(2);

    await sleep(5);
    await loop.tick();
    expect(store.get(job.id).status).toBe('completed');
    expect(store.get(job.id).attempts).toBe(3);
  });

  it('fails unknown handlers gracefully and stop waits for in-flight jobs', async () => {
    const store = new InMemoryJobStore();
    const loop = new WorkerLoop({ store, config: { concurrency: 1, pollIntervalMs: 5, retry: { policy: 'none', delayMs: 0, maxAttempts: 1, maxDelayMs: 0 } } });

    const unknown = store.enqueue({ type: 'worker.missing', payload: {} });
    await loop.tick();
    expect(store.get(unknown.id).status).toBe('failed');
    expect(store.get(unknown.id).lastError?.code).toBe('WORKER_HANDLER_NOT_FOUND');

    const gate = createDeferred<void>();
    loop.registerHandler('worker.slow', async () => {
      await gate.promise;
      return 'done';
    });
    store.enqueue({ type: 'worker.slow', payload: {} });

    loop.start();
    await sleep(10);
    const stopping = loop.stop();
    let finished = false;
    stopping.then(() => {
      finished = true;
    });

    await sleep(10);
    expect(finished).toBe(false);
    gate.resolve();
    await stopping;
    expect(finished).toBe(true);
  });
});

describe('WKR-006 worker service facade', () => {
  it('returns created jobs and aggregate stats', async () => {
    const service = new WorkerService({ config: { concurrency: 1, pollIntervalMs: 10, retry: { policy: 'none', delayMs: 0, maxAttempts: 1, maxDelayMs: 0 } } });
    service.registerHandler('worker.echo', async (job) => ({ echoed: job.payload }));
    const job = service.enqueue({ type: 'worker.echo', payload: { hello: 'world' } });

    const statsBefore = service.stats();
    expect(statsBefore.jobs.pending).toBe(1);
    expect(statsBefore.handlers).toBe(1);

    await service.tick();
    const done = service.getJob(job.id);
    expect(done.status).toBe('completed');
    expect(done.result).toEqual({ echoed: { hello: 'world' } });

    const statsAfter = service.stats();
    expect(statsAfter.jobs.completed).toBe(1);
    expect(statsAfter.jobs.total).toBe(1);
    await service.stop();
  });
});
