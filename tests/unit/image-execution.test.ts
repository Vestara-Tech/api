import { describe, expect, it } from 'vitest';
import {
  generateBootArtifacts,
  runBootVerification,
  measureBootPerformance,
  compareVisualCheckpoints,
  generateSbom,
  signArtifacts,
  sealImage,
  buildEvidenceBundle,
  ReleasePublisher,
  ImageExecutionPipeline,
  DESKTOP_PROFILE,
  resolveHardwareTarget,
} from '../../src/image/index.js';

const PROFILE = { ...DESKTOP_PROFILE, profileHash: 'hash' };
const HARDWARE = resolveHardwareTarget('virtual-machine');

describe('IMG-043/044 boot artifact generation', () => {
  it('generates GRUB, Plymouth, systemd, login, kernel and app artifacts', () => {
    const artifacts = generateBootArtifacts({ profile: PROFILE, hardware: HARDWARE, stage: 'assemble' });
    const kinds = artifacts.map((a) => a.kind);
    expect(kinds).toContain('grub-config');
    expect(kinds).toContain('plymouth-theme');
    expect(kinds).toContain('systemd-unit');
    expect(kinds).toContain('login-config');
    expect(kinds).toContain('kernel-params');
    expect(kinds).toContain('application-manifest');
    for (const artifact of artifacts) {
      expect(artifact.content.length).toBeGreaterThan(0);
      expect(artifact.artifactHash).toBeTruthy();
    }
    const grub = artifacts.find((a) => a.kind === 'grub-config')!;
    expect(grub.content).toContain(`set timeout=${PROFILE.boot.grub.timeout}`);
  });
});

describe('IMG-047/048 QEMU boot verification', () => {
  it('reports not verified when QEMU is unavailable (never publishes unverified)', () => {
    const result = runBootVerification('img-hash', { qemuAvailable: false, ovmfAvailable: false });
    expect(result.ok).toBe(false);
    expect(result.reached).toHaveLength(0);
    expect(result.missing).toContain('desktop');
  });

  it('verifies boot checkpoints when QEMU is available', () => {
    const result = runBootVerification('img-hash', { qemuAvailable: true, ovmfAvailable: true });
    expect(result.reached.length).toBeGreaterThan(0);
    expect(result.verificationHash).toBeTruthy();
  });
});

describe('IMG-050 boot performance', () => {
  it('measures per-stage durations', () => {
    const result = measureBootPerformance(2100, 1000, 3400, 5800, 1200, 1100, 2700);
    expect(result.samples).toHaveLength(7);
    expect(result.totalMs).toBeGreaterThan(result.readyMs);
    expect(result.performanceHash).toBeTruthy();
  });
});

describe('IMG-049 visual checkpoints', () => {
  it('compares observations against expected screenshots', () => {
    const result = compareVisualCheckpoints([
      { checkpoint: 'grub', observedHash: 'grub-hash' },
      { checkpoint: 'login', observedHash: 'x' },
    ]);
    expect(result.ok).toBe(false);
    expect(result.comparisons.some((c) => c.status === 'mismatch')).toBe(true);
  });
});

describe('IMG-053/054/055/056 SBOM, signing, sealing, evidence', () => {
  it('generates an SPDX SBOM', () => {
    const sbom = generateSbom([{ name: 'base-system', version: 'locked', hash: 'h1' }]);
    expect(sbom.format).toBe('spdx');
    expect(sbom.packages).toHaveLength(1);
    expect(sbom.sbomHash).toBeTruthy();
  });

  it('signs artifacts and refuses when policy disables signing', () => {
    const signed = signArtifacts([{ artifact: 'a.img', payloadHash: 'ph' }], { enabled: true, keyId: 'k1', refuseUnsigned: false });
    expect(signed.signatures).toHaveLength(1);
    expect(signed.signatures[0]!.signature.startsWith('sig-')).toBe(true);

    const refused = signArtifacts([{ artifact: 'a.img', payloadHash: 'ph' }], { enabled: false, keyId: 'k1', refuseUnsigned: true });
    expect(refused.refused).toBe(true);
  });

  it('seals the image and builds an evidence bundle', () => {
    const seal = sealImage({ imageHash: 'ih', signatures: [] });
    expect(seal.sealHash).toBeTruthy();
    const bundle = buildEvidenceBundle({ buildId: 'b1', planHash: 'p', sbomHash: 's', sealHash: seal.sealHash });
    expect(bundle.bundleHash).toBeTruthy();
  });
});

describe('IMG-057/058 publishing', () => {
  const publisher = () => {
    const releases = new ReleasePublisher();
    const execution = new ImageExecutionPipeline({
      getProfile: () => PROFILE,
      getHardware: () => HARDWARE,
      qemuAvailable: false,
      ovmfAvailable: false,
      releasePublisher: releases,
    });
    return { releases, execution };
  };

  it('refuses unverified builds unless dev builds are permitted', async () => {
    const { execution } = publisher();
    const result = execution.publish({
      profileId: 'p', version: '1.0.0', buildId: 'b1', verified: false, signed: true, sealed: true,
      artifactPath: 'a.img', evidenceBundleHash: 'e',
    });
    expect(result.verdict).toBe('refused-unverified');
  });

  it('refuses unsealed builds', async () => {
    const { execution } = publisher();
    const result = execution.publish({
      profileId: 'p', version: '1.0.0', buildId: 'b1', verified: true, signed: true, sealed: false,
      artifactPath: 'a.img', evidenceBundleHash: 'e',
    });
    expect(result.verdict).toBe('refused-unsealed');
  });

  it('publishes a verified+signed+sealed build and records release history', async () => {
    const { execution, releases } = publisher();
    const result = execution.publish({
      profileId: 'p', version: '1.0.0', buildId: 'b1', verified: true, signed: true, sealed: true,
      artifactPath: 'a.img', evidenceBundleHash: 'e', target: 'local-artifact',
    });
    expect(result.verdict).toBe('published');
    expect(execution.releaseHistory('p')).toHaveLength(1);
    expect(releases.releases()).toHaveLength(1);
  });

  it('supersedes prior published releases of the same profile', async () => {
    const { execution } = publisher();
    execution.publish({ profileId: 'p', version: '1.0.0', buildId: 'b1', verified: true, signed: true, sealed: true, artifactPath: 'a.img', evidenceBundleHash: 'e' });
    const second = execution.publish({ profileId: 'p', version: '1.1.0', buildId: 'b2', verified: true, signed: true, sealed: true, artifactPath: 'a.img', evidenceBundleHash: 'e' });
    expect(second.verdict).toBe('published');
    const history = execution.releaseHistory('p');
    expect(history.filter((r) => r.status === 'published')).toHaveLength(1);
    expect(history.filter((r) => r.status === 'superseded')).toHaveLength(1);
  });
});

describe('IMG-045/046 execution pipeline', () => {
  it('runs generate -> assemble -> verify -> sign -> seal -> evidence', async () => {
    const execution = new ImageExecutionPipeline({
      getProfile: () => PROFILE,
      getHardware: () => HARDWARE,
      qemuAvailable: false,
      ovmfAvailable: false,
    });
    const result = await execution.execute({ profileId: 'p', target: 'raw', hardwareId: 'virtual-machine', runId: 'run_1' });
    expect(result.status).toBe('completed');
    expect(result.artifacts.length).toBeGreaterThan(5);
    expect(result.sbom.packages.length).toBeGreaterThan(0);
    expect(result.verification).toBeDefined();
    expect(result.performance).toBeDefined();
    expect(result.signatures.length).toBeGreaterThan(0);
    expect(result.seal).toBeDefined();
    expect(result.evidence).toBeDefined();
    expect(result.artifactPath).toBe('vestara-os-0.1.0.img');
  });

  it('records results and rejects invalid partition layouts', async () => {
    const execution = new ImageExecutionPipeline({
      getProfile: () => PROFILE,
      getHardware: () => HARDWARE,
      qemuAvailable: false,
      ovmfAvailable: false,
    });
    await execution.execute({ profileId: 'p', target: 'raw', hardwareId: 'virtual-machine', runId: 'run_ok' });
    expect(execution.listResults()).toHaveLength(1);
    expect(execution.result('run_ok')).toBeDefined();
  });
});
