import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../../src/app.js';
import { createApplication } from '../../src/bootstrap/application.js';
import { loadConfig } from '../../src/config/schema.js';

const committedPath = resolve('contracts', 'openapi', 'vestara-api-v2.json');

let generated: Record<string, unknown>;

beforeAll(async () => {
  const config = loadConfig({});
  const application = createApplication(config);
  const app = await buildApp({ config, application, exposeDocs: false });
  await app.ready();
  generated = app.swagger() as Record<string, unknown>;
  await app.close();
});

describe('OpenAPI contract', () => {
  it('committed contract exists and is valid JSON', () => {
    const spec = JSON.parse(readFileSync(committedPath, 'utf8')) as Record<string, unknown>;
    expect(spec.openapi).toBe('3.1.0');
  });

  it('committed contract matches the generated spec (no drift)', () => {
    const stored = JSON.parse(readFileSync(committedPath, 'utf8'));
    expect(generated).toEqual(stored);
  });

  it('declares the implemented routes', () => {
    const paths = (generated.paths as Record<string, unknown>) ?? {};
    for (const route of ['/health/live', '/health/ready', '/api/v2', '/api/v2/system']) {
      expect(paths[route]).toBeDefined();
    }
  });
});
