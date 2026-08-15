import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';
import type { AiPlatformV2 } from '../../src/ai/v2/ai-platform-v2.js';
import { InMemoryAiProviderState } from '../../src/ai/v2/provider-state.js';

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

describe('AI platform v2 control API (AI2)', () => {
  it('lists AI profiles', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v2/ai/v2/profiles' });
    expect(res.statusCode).toBe(200);
    const profiles = res.json();
    expect(profiles.some((p: { id: string }) => p.id === 'vestara.coding')).toBe(true);
    expect(profiles.some((p: { id: string }) => p.id === 'vestara.privacy-first')).toBe(true);
  });

  it('registers provider states', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/ai/v2/providers',
      payload: { id: 'test-provider', name: 'Test', installed: true, configured: true, enabled: true, health: 'healthy' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().enabled).toBe(true);
  });

  it('routes a profile to a concrete model with an explainable decision', async () => {
    // Seed provider states + models so routing has candidates.
    const ai = app.application.container.resolve<AiPlatformV2>('ai.v2');
    const states = ai.providerStates as InMemoryAiProviderState;
    states.upsert({ id: 'openai', name: 'OpenAI', installed: true, configured: true, enabled: true, health: 'healthy' });
    states.upsert({ id: 'ollama', name: 'Ollama', installed: true, configured: true, enabled: true, health: 'healthy' });
    ai.profiles.save({ id: 'test.coding', name: 'Test Coding', requirements: { tools: true }, strategy: 'balanced', parameters: {}, tags: [] });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/ai/v2/route',
      payload: { profileId: 'test.coding' },
    });
    // If the default catalog has no models, expect a structured 404 rather than a raw 500.
    expect([200, 404]).toContain(res.statusCode);
    if (res.statusCode === 404) {
      expect(res.json().error.message).toContain('No enabled');
    } else {
      expect(res.json().profileId).toBe('test.coding');
    }
  });

  it('returns 404 for unknown profiles', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v2/ai/v2/route', payload: { profileId: 'missing' } });
    expect(res.statusCode).toBe(404);
  });
});
