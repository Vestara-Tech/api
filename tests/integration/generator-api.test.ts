import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';
import { snapshotFromConfiguration } from '../../src/bootstrap/generator.js';

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

describe('generator wiring (GEN-001..006)', () => {
  it('registers the example generator and exposes the capability', async () => {
    expect(app.application.generators.has('generator.api.typescript')).toBe(true);
    expect(app.application.generation).toBeDefined();

    const res = await app.inject({ method: 'GET', url: '/api/v2/system' });
    expect(res.json().capabilities).toContain('generator');
  });

  it('discovers generators by capability', () => {
    const found = app.application.generators.discover(['generator.sdk.typescript']);
    expect(found.map((g) => g.id)).toContain('generator.api.typescript');
  });

  it('runs the example generator with a configuration snapshot', async () => {
    const configuration = snapshotFromConfiguration(app.application.configuration);
    const result = await app.application.generation.run({
      generatorId: 'generator.api.typescript',
      input: {
        apiName: 'Products',
        endpoints: [
          { method: 'GET', path: '/products' },
          { method: 'POST', path: '/products' },
        ],
      },
      configuration,
    });
    expect(result.artifacts.has('index.ts')).toBe(true);
    const content = result.artifacts.get('index.ts')!.content;
    expect(content).toContain('Products');
    expect(content).toContain('"/products"');
    expect(result.evidence.configurationHash).toBe(configuration.snapshotHash);
    expect(result.evidence.generatorVersion).toBe('1.0.0');
  });

  it('produces deterministic evidence across runs', async () => {
    const configuration = snapshotFromConfiguration(app.application.configuration);
    const input = { apiName: 'Products', endpoints: [{ method: 'GET', path: '/products' }] };
    const a = await app.application.generation.run({ generatorId: 'generator.api.typescript', input, configuration });
    const b = await app.application.generation.run({ generatorId: 'generator.api.typescript', input, configuration });
    expect(a.evidence.evidenceHash).toBe(b.evidence.evidenceHash);
  });
});
