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

describe('image execution pipeline API (IMG-043..058)', () => {
  it('runs the full execution pipeline', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/image/execute',
      payload: { profileId: 'vestara-desktop', target: 'raw', hardwareId: 'virtual-machine', runId: 'run_exec_1' },
    });
    expect(res.statusCode).toBe(200);
    const result = res.json();
    expect(result.status).toBe('completed');
    expect(result.artifacts.length).toBeGreaterThan(5);
    expect(result.sbom.packages.length).toBeGreaterThan(0);
    expect(result.verification.verificationHash).toBeTruthy();
    expect(result.performance.totalMs).toBeGreaterThan(0);
    expect(result.signatures.length).toBeGreaterThan(0);
    expect(result.seal.sealHash).toBeTruthy();
    expect(result.evidence.bundleHash).toBeTruthy();
    expect(result.artifactPath).toBe('vestara-os-0.1.0.img');
  });

  it('publishes a verified build and lists release history', async () => {
    const publish = await app.inject({
      method: 'POST',
      url: '/api/v2/image/publish',
      payload: {
        profileId: 'vestara-desktop', version: '1.0.0', buildId: 'b1', verified: true, signed: true, sealed: true,
        artifactPath: 'a.img', evidenceBundleHash: 'e', target: 'local-artifact',
      },
    });
    expect(publish.statusCode).toBe(200);
    expect(publish.json().verdict).toBe('published');

    const releases = await app.inject({ method: 'GET', url: '/api/v2/image/releases' });
    expect(releases.json().length).toBe(1);

    const profileReleases = await app.inject({ method: 'GET', url: '/api/v2/image/releases/vestara-desktop' });
    expect(profileReleases.json().length).toBe(1);
  });

  it('refuses to publish an unverified build', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v2/image/publish',
      payload: {
        profileId: 'vestara-desktop', version: '1.0.0', buildId: 'b2', verified: false, signed: true, sealed: true,
        artifactPath: 'a.img', evidenceBundleHash: 'e',
      },
    });
    expect(res.json().verdict).toBe('refused-unverified');
  });
});
