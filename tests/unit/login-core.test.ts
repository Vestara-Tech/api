import { describe, expect, it } from 'vitest';
import { LoginBroker, type OsIdentityMapper } from '../../src/login/service/login-broker.js';
import { OsSessionManager } from '../../src/login/service/session-manager.js';
import { LoginRateLimit } from '../../src/login/service/rate-limit.js';
import type { OsAuthenticationAdapter, DisplayManagerAdapter } from '../../src/login/adapters/os-auth.js';
import { isPreAuthAllowed, FORBIDDEN_PREAUTH } from '../../src/login/domain/preauth.js';
import { createDesktopSessionDefinition } from '../../src/login/domain/desktop-session.js';

function buildBroker() {
  const osAuth: OsAuthenticationAdapter = {
    id: 'test',
    async authenticate(req) {
      return { ok: req.secret === 'correct' };
    },
    async listUsers() {
      return [{ userId: '1000', displayName: 'Eddie' }];
    },
    async getPrincipal(uid) {
      return uid === 1000 ? { uid: 1000, username: 'eddie', displayName: 'Eddie', homeDir: '/home/eddie', shell: '/bin/bash' } : null;
    },
  };
  const displayManager: DisplayManagerAdapter = {
    id: 'test-dm',
    async discover() {
      return { available: true, name: 'test' };
    },
    async listUsers() {
      return [{ userId: '1000', displayName: 'Eddie' }];
    },
    async startSession() {
      return { ok: true, sessionId: 'os-1' };
    },
    async terminateSession() {},
  };
  const identityMapper: OsIdentityMapper = {
    async map(uid, username) {
      return { uid, username, vestaraIdentityId: `idn_${uid}` };
    },
    async link() {},
  };
  const broker = new LoginBroker({ osAuth, displayManager, identityMapper });
  return { broker, osAuth, displayManager };
}

describe('LoginBroker (LOGIN-005/007)', () => {
  it('reports capabilities with password + recovery', async () => {
    const { broker } = buildBroker();
    const caps = await broker.capabilities();
    expect(caps.password).toBe(true);
    expect(caps.recovery).toBe(true);
    expect(caps.fido2).toBe(false);
  });

  it('lists users', async () => {
    const { broker } = buildBroker();
    expect(await broker.listUsers()).toHaveLength(1);
  });

  it('authenticates with a correct secret and starts an OS session', async () => {
    const { broker, displayManager } = buildBroker();
    const result = await broker.authenticate({ userId: '1000', method: 'password', secret: 'correct' });
    expect(result.status).toBe('authenticated');
    if (result.status === 'authenticated') expect(result.sessionId).toBe('os-1');
    expect(displayManager.startSession).toBeDefined();
  });

  it('denies an incorrect secret', async () => {
    const { broker } = buildBroker();
    const result = await broker.authenticate({ userId: '1000', method: 'password', secret: 'wrong' });
    expect(result.status).toBe('denied');
  });
});

describe('OsSessionManager (LOGIN-006/010)', () => {
  it('creates, locks, unlocks, and terminates sessions', () => {
    const manager = new OsSessionManager();
    const session = manager.createSession('1000');
    expect(manager.currentForUser('1000')?.id).toBe(session.id);
    manager.lock(session.id);
    expect(manager.get(session.id)?.status).toBe('locked');
    manager.unlock(session.id);
    expect(manager.get(session.id)?.status).toBe('active');
    manager.terminate(session.id);
    expect(manager.get(session.id)?.status).toBe('terminated');
  });
});

describe('LoginRateLimit (LOGIN-009)', () => {
  it('locks after the max attempts in a window', () => {
    const rate = new LoginRateLimit({ maxAttempts: 3, windowMs: 60_000, lockoutMs: 300_000 });
    rate.recordFailure('1000');
    rate.recordFailure('1000');
    expect(rate.isBlocked('1000')).toBe(false);
    const locked = rate.recordFailure('1000');
    expect(locked).toBe(true);
    expect(rate.isBlocked('1000')).toBe(true);
  });

  it('resets on success', () => {
    const rate = new LoginRateLimit({ maxAttempts: 2, windowMs: 60_000, lockoutMs: 300_000 });
    rate.recordFailure('1000');
    rate.recordSuccess('1000');
    rate.recordFailure('1000');
    expect(rate.isBlocked('1000')).toBe(false);
  });
});

describe('pre-auth capabilities (LOGIN-012)', () => {
  it('allows restricted greeter capabilities', () => {
    expect(isPreAuthAllowed('preauth.power.reboot')).toBe(true);
    expect(isPreAuthAllowed('preauth.network.status')).toBe(true);
    expect(isPreAuthAllowed('preauth.power.shutdown')).toBe(true);
  });

  it('forbids builder/generator/marketplace/arbitrary system', () => {
    expect(isPreAuthAllowed('builder')).toBe(false);
    expect(isPreAuthAllowed('generator')).toBe(false);
    expect(isPreAuthAllowed('marketplace')).toBe(false);
    expect(isPreAuthAllowed('system.arbitrary')).toBe(false);
    expect(FORBIDDEN_PREAUTH).toContain('builder');
  });
});

describe('desktop session definition (LOGIN-014)', () => {
  it('computes a deterministic session hash', () => {
    const session = createDesktopSessionDefinition({
      id: 'vestara',
      name: 'Vestara',
      entry: 'wayland',
      desktopEntryPath: '/usr/share/wayland-sessions/vestara.desktop',
      exec: '/usr/lib/vestara/session',
      startupApp: '@vestara/app-startup',
      desktopApp: '@vestara/app-desktop',
    });
    expect(session.sessionHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
