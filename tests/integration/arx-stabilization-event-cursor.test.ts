/**
 * ARX-STAB-002 — Event cursor HTTP contract regression.
 *
 * The governed Activity Room run is created successfully, but event polling
 * failed because `afterSequence` arrives as a query-string value while the
 * Fastify schema required a number (FST_ERR_VALIDATION 400). The fix
 * normalizes and validates `afterSequence` at the HTTP boundary.
 *
 * These tests use the REAL HTTP wire representation:
 *   GET /api/v2/activity-room/history/:executionId/events?afterSequence=0
 *
 * and assert omitted / 0 / nonzero / malformed cursors behave correctly.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';

interface Envelope {
  readonly sequence: number;
  readonly type: string;
}

let app: Awaited<ReturnType<typeof buildApp>>;

beforeAll(async () => {
  const config = loadConfig({});
  const application = createApplication(config);
  app = await buildApp({ config, application });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

async function createExecution(): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v2/activity-room/runs',
    payload: { goal: 'Generate a TypeScript script', principalId: 'stab-002' },
  });
  expect(res.statusCode).toBe(201);
  return (res.json() as { executionId: string }).executionId;
}

describe('GET /api/v2/activity-room/history/:executionId/events (afterSequence)', () => {
  it('returns events when afterSequence is omitted (transport default 0)', async () => {
    const executionId = await createExecution();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v2/activity-room/history/${executionId}/events`,
    });

    expect(res.statusCode).toBe(200);
    const events = res.json() as readonly Envelope[];
    // The durable fact records an execution-requested event immediately.
    expect(events.length).toBeGreaterThan(0);
    for (const event of events) {
      expect(Number.isSafeInteger(event.sequence)).toBe(true);
      expect(event.sequence).toBeGreaterThanOrEqual(0);
    }
  });

  it('returns events when afterSequence=0 is sent as a query string', async () => {
    const executionId = await createExecution();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v2/activity-room/history/${executionId}/events?afterSequence=0`,
    });

    expect(res.statusCode).toBe(200);
    const events = res.json() as readonly Envelope[];
    expect(events.length).toBeGreaterThan(0);
    // afterSequence=0 is inclusive of every event.
    expect(events[0]?.sequence).toBeGreaterThanOrEqual(0);
  });

  it('filters to only events after a nonzero cursor', async () => {
    const executionId = await createExecution();

    const allRes = await app.inject({
      method: 'GET',
      url: `/api/v2/activity-room/history/${executionId}/events`,
    });
    const allEvents = allRes.json() as readonly Envelope[];
    expect(allEvents.length).toBeGreaterThan(1);

    const cursor = 3;
    const res = await app.inject({
      method: 'GET',
      url: `/api/v2/activity-room/history/${executionId}/events?afterSequence=${cursor}`,
    });

    expect(res.statusCode).toBe(200);
    const filtered = res.json() as readonly Envelope[];
    expect(filtered.length).toBeLessThan(allEvents.length);
    for (const event of filtered) {
      expect(event.sequence).toBeGreaterThan(cursor);
    }
  });

  it.each([
    ['-1', 'negative'],
    ['abc', 'non-numeric'],
    ['1.5', 'fractional'],
  ])('returns a controlled 400 for malformed afterSequence=%s (%s)', async (value, _label) => {
    const executionId = await createExecution();

    const res = await app.inject({
      method: 'GET',
      url: `/api/v2/activity-room/history/${executionId}/events?afterSequence=${encodeURIComponent(value)}`,
    });

    expect(res.statusCode).toBe(400);
  });
});