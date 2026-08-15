import { describe, expect, it } from 'vitest';
import { BrowserService, BrowserSessionManager, BrowserRuntimeRegistry, BrowserPolicyGateway, BrowserEvidenceCollector, PlaywrightBrowserRuntime, BrowserUseBrowserRuntime, type BrowserProfile } from '../../src/browser/index.js';

function profile(): BrowserProfile {
  return { id: 'engineering', name: 'Engineering', runtime: 'playwright', browser: 'chromium', headless: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
}

function buildService() {
  const sessions = new BrowserSessionManager();
  const runtimes = new BrowserRuntimeRegistry();
  runtimes.register(new PlaywrightBrowserRuntime());
  runtimes.register(new BrowserUseBrowserRuntime());
  const policy = new BrowserPolicyGateway();
  const evidence = new BrowserEvidenceCollector();
  const service = new BrowserService({ sessions, runtimes, policy, evidence });
  return { sessions, runtimes, policy, evidence, service };
}

describe('BRW-002 runtime registry + capabilities', () => {
  it('registers playwright (deterministic) and browser-use (agentic)', async () => {
    const { runtimes } = buildService();
    const pw = await runtimes.get('playwright').capabilities();
    const bu = await runtimes.get('browser-use').capabilities();
    expect(pw.deterministic).toBe(true);
    expect(bu.agentic).toBe(true);
    expect(bu.humanTakeover).toBe(true);
  });
});

describe('BRW-002 session + profile managers', () => {
  it('registers profiles and creates sessions', async () => {
    const { service, sessions } = buildService();
    service.registerProfile(profile());
    expect(service.listProfiles()).toHaveLength(1);
    const session = await service.createSession('engineering', 'playwright');
    expect(session.profileId).toBe('engineering');
    expect(sessions.listSessions()).toHaveLength(1);
  });
});

describe('BRW-010 policy gateway (governed browser execution)', () => {
  it('allows low/medium actions but requires approval for execute-script', () => {
    const policy = new BrowserPolicyGateway();
    const navigate = policy.evaluate({ id: 'a', kind: 'navigate', url: 'https://x' }, true);
    expect(navigate.allowed).toBe(true);
    const script = policy.evaluate({ id: 'b', kind: 'execute-script', script: 'document' }, true);
    expect(script.allowed).toBe(false);
    expect(script.approvalRequired).toBe(true);
  });

  it('denies when the agent lacks the permission', () => {
    const policy = new BrowserPolicyGateway();
    const decision = policy.evaluate({ id: 'c', kind: 'navigate', url: 'https://x' }, false);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain('lacks');
  });
});

describe('BRW-007 evidence collector', () => {
  it('records action evidence', () => {
    const evidence = new BrowserEvidenceCollector();
    evidence.record({ sessionId: 'bs1', url: 'https://vestara.dev', action: 'navigate', runtime: 'playwright' });
    evidence.record({ sessionId: 'bs1', url: 'https://vestara.dev/about', action: 'navigate', runtime: 'playwright' });
    expect(evidence.list('bs1')).toHaveLength(2);
    expect(evidence.list('bs1')[0]!.timestamp).toBeTruthy();
  });
});

describe('BRW-009 browser service end-to-end', () => {
  it('navigates with policy gate and records evidence', async () => {
    const { service } = buildService();
    service.registerProfile(profile());
    const session = await service.createSession('engineering', 'playwright');
    const result = await service.navigate(session.id, 'https://vestara.dev', true);
    expect(result.evidence.action).toBe('navigate');
    expect(result.evidence.sessionId).toBe(session.id);
    expect(service.evidence()).toHaveLength(1);
    expect(service.listSessions()[0]!.tabs[0]!.url).toBe('https://vestara.dev');
  });

  it('rejects navigation without permission', async () => {
    const { service } = buildService();
    service.registerProfile(profile());
    const session = await service.createSession('engineering', 'playwright');
    await expect(service.navigate(session.id, 'https://x', false)).rejects.toThrow(/lacks/);
  });
});
