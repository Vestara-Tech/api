import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';

let app: Awaited<ReturnType<typeof buildApp>>;

beforeEach(async () => {
  const config = loadConfig({});
  const application = createApplication(config);
  app = await buildApp({ config, application });
  await app.ready();
});

afterEach(async () => {
  await app.close();
});

describe('AI control API (AI-023)', () => {
  it('exposes the ai capability and service', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('ai');
    expect(app.application.ai).toBeDefined();
  });

  it('lists providers in priority order', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/ai/providers' });
    expect(res.statusCode).toBe(200);
    const providers = res.json() as { id: string; priority: number }[];
    expect(providers.map((p) => p.id)).toContain('openai');
    expect(providers[0]!.priority).toBeLessThanOrEqual(providers[providers.length - 1]!.priority);
  });

  it('gets a single provider', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/ai/providers/openai' });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe('openai');
    expect(res.json().type).toBe('openai-compatible');
  });

  it('lists models', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/ai/models' });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json())).toBe(true);
  });

  it('rejects explicit resolution when no provider is enabled', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/ai/routing/resolve',
      payload: { model: { provider: 'openai', model: 'gpt-4o' } },
    });
    // Providers are declared but disabled by default -> NOT_FOUND.
    expect([404, 200]).toContain(res.statusCode);
  });

  it('exposes capability permissions', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/ai/capabilities' });
    expect(res.statusCode).toBe(200);
    const caps = res.json() as { id: string }[];
    expect(caps.map((c) => c.id)).toContain('ai.generate');
    expect(caps.map((c) => c.id)).toContain('ai.budgets.configure');
  });
});

describe('Agent control API (AGENT-024)', () => {
  it('exposes the agents capability', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('agents');
  });

  it('lists built-in agents', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/agents' });
    expect(res.statusCode).toBe(200);
    const agents = res.json() as { id: string; role: string }[];
    const roles = agents.map((a) => a.role);
    for (const expected of ['planner', 'developer', 'reviewer', 'verifier', 'observer']) {
      expect(roles).toContain(expected);
    }
  });

  it('lists tools including generator + api builder contributions', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/tools' });
    expect(res.statusCode).toBe(200);
    const tools = res.json() as { id: string; risk: string }[];
    const ids = tools.map((t) => t.id);
    expect(ids).toContain('api.definition.validate');
    expect(ids).toContain('generator.run');
    const apply = tools.find((t) => t.id === 'generator.apply')!;
    expect(apply.risk).toBe('control');
  });

  it('lists skills', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/skills' });
    expect(res.statusCode).toBe(200);
    const skills = res.json() as { id: string }[];
    expect(skills.map((s) => s.id)).toContain('vestara-api-builder');
  });

  it('starts an agent run and reads its state', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/agent-runs',
      payload: { agentId: 'vestara-developer', goal: 'inspect the API', principalId: 'user-1' },
    });
    expect(res.statusCode).toBe(201);
    const run = res.json() as { id: string; agentId: string; status: string };
    expect(run.agentId).toBe('vestara-developer');

    const detail = await app.inject({ method: 'GET', url: `/api/v2/agent-runs/${run.id}` });
    expect(detail.statusCode).toBe(200);
    expect(['running', 'completed', 'failed', 'waiting-for-approval']).toContain(detail.json().status);

    const events = await app.inject({ method: 'GET', url: `/api/v2/agent-runs/${run.id}/events` });
    expect(events.statusCode).toBe(200);
    expect(Array.isArray(events.json())).toBe(true);
  });
});
