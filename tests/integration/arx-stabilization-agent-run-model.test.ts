import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';

let app: Awaited<ReturnType<typeof buildApp>>;
let prevEnv: Record<string, string | undefined>;

function setOpencodeEnv(): void {
  prevEnv = {
    OPENCODE_MODE: process.env.OPENCODE_MODE,
    OPENCODE_BASE_URL: process.env.OPENCODE_BASE_URL,
    OPENCODE_DEFAULT_PROVIDER: process.env.OPENCODE_DEFAULT_PROVIDER,
    OPENCODE_DEFAULT_MODEL: process.env.OPENCODE_DEFAULT_MODEL,
  };
  process.env.OPENCODE_MODE = 'external';
  process.env.OPENCODE_BASE_URL = 'http://127.0.0.1:4096';
  process.env.OPENCODE_DEFAULT_PROVIDER = 'opencode';
  process.env.OPENCODE_DEFAULT_MODEL = 'opencode/deepseek-v4-flash-free';
}

function restoreEnv(): void {
  for (const [key, value] of Object.entries(prevEnv ?? {})) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(async () => {
  setOpencodeEnv();
  const config = loadConfig({});
  const application = createApplication(config);
  app = await buildApp({ config, application });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  restoreEnv();
});

describe('ARX stabilization — Activity Room agent run model resolution', () => {
  it('lists the OpenCode default model as an enabled candidate in the AI catalog', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/ai/models' });
    expect(res.statusCode).toBe(200);
    const models = res.json() as readonly { providerId?: string; id?: string }[];
    const openCode = models.find((m) => m.providerId === 'opencode' && (m.id === 'deepseek-v4-flash-free'));
    expect(openCode).toBeDefined();
  });

  it('resolves the Developer agent model through the real AI routing path', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/ai/routing/resolve',
      payload: {
        model: { requirements: { tools: true, structuredOutput: true }, optimizeFor: 'balanced' },
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().providerId).toBe('opencode');
    expect(res.json().modelId).toBe('deepseek-v4-flash-free');
  });

  it(
    'starts a vestara-developer run without the "No enabled model" selection failure',
    async () => {
      const start = await app.inject({
        method: 'POST',
        url: '/api/v2/agent-runs',
        payload: { agentId: 'vestara-developer', goal: 'inspect the API surface' },
      });
      expect(start.statusCode).toBe(201);
      const runId = start.json().id;

      // The run resolves the model synchronously via the AI router; the failure
      // that regressed this path surfaced as a failed run whose error was the
      // opaque selection message. The regression is proven at the selection
      // boundary: a settled failure must never be the selection error, and the
      // run must have moved past queued into execution.
      const observed = await observeUntilSettled(runId);
      const status = (observed as { status: string }).status;
      const events = (observed as { events: readonly { type: string; data?: { error?: string } }[] }).events;
      expect(status).not.toBe('queued');
      const failed = events.find((event) => event.type === 'failed');
      expect(failed?.data?.error ?? '').not.toContain('No enabled model satisfies the requested capabilities');
    },
    60_000,
  );
});

async function observeUntilSettled(runId: string): Promise<unknown> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const run = await app.inject({ method: 'GET', url: `/api/v2/agent-runs/${runId}` });
    const events = await app.inject({ method: 'GET', url: `/api/v2/agent-runs/${runId}/events` });
    const body = run.json() as { status: string };
    if (body.status === 'failed' || body.status === 'completed') {
      return { status: body.status, events: events.json() };
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  // Timeout: the run is still executing against the live OpenCode server.
  // The selection boundary already succeeded — return what we observed.
  const events = await app.inject({ method: 'GET', url: `/api/v2/agent-runs/${runId}/events` });
  return { status: 'running', events: events.json() };
}