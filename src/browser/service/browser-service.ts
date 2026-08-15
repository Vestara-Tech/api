import { randomId } from '../../core/identifiers.js';
import type { BrowserAction, BrowserProfile, BrowserSession, BrowserEvent, BrowserActionEvidence, BrowserRuntimeId } from '../contracts.js';
import { BrowserSessionManager } from '../session/browser-session-manager.js';
import { BrowserRuntimeRegistry } from '../registry/browser-runtime-registry.js';
import { BrowserPolicyGateway } from '../policy/browser-policy-gateway.js';
import { BrowserEvidenceCollector } from '../evidence/browser-evidence-collector.js';

export interface BrowserServiceOptions {
  readonly sessions: BrowserSessionManager;
  readonly runtimes: BrowserRuntimeRegistry;
  readonly policy: BrowserPolicyGateway;
  readonly evidence: BrowserEvidenceCollector;
}

export interface BrowserService {
  registerProfile(profile: BrowserProfile): BrowserProfile;
  listProfiles(): readonly BrowserProfile[];
  createSession(profileId: string, runtime: BrowserRuntimeId): Promise<BrowserSession>;
  navigate(sessionId: string, url: string, hasPermission: boolean): Promise<{ action: BrowserAction; evidence: BrowserActionEvidence }>;
  screenshot(sessionId: string): Promise<{ action: BrowserAction; evidence: BrowserActionEvidence }>;
  listSessions(): readonly BrowserSession[];
  evidence(): readonly BrowserActionEvidence[];
}

/**
 * BRW — Browser service facade. Vestara owns sessions, profiles, policies,
 * evidence and events; the runtime registry provides execution.
 */
export class BrowserService implements BrowserService {
  private readonly sessions: BrowserSessionManager;
  private readonly runtimes: BrowserRuntimeRegistry;
  private readonly policy: BrowserPolicyGateway;
  private readonly evidenceCollector: BrowserEvidenceCollector;

  constructor(options: BrowserServiceOptions) {
    this.sessions = options.sessions;
    this.runtimes = options.runtimes;
    this.policy = options.policy;
    this.evidenceCollector = options.evidence;
  }

  registerProfile(profile: BrowserProfile): BrowserProfile {
    return this.sessions.registerProfile(profile);
  }

  listProfiles(): readonly BrowserProfile[] {
    return this.sessions.listProfiles();
  }

  async createSession(profileId: string, runtime: BrowserRuntimeId): Promise<BrowserSession> {
    const session = this.sessions.createSession(profileId, runtime);
    const rt = this.runtimes.get(runtime);
    const live = await rt.createSession(this.sessions.getProfile(profileId));
    return this.sessions.updateSession(session.id, { status: live.status });
  }

  async navigate(sessionId: string, url: string, hasPermission: boolean): Promise<{ action: BrowserAction; evidence: BrowserActionEvidence }> {
    const session = this.sessions.getSession(sessionId);
    const decision = this.policy.evaluate({ id: randomId('act'), kind: 'navigate', url }, hasPermission);
    if (!decision.allowed) throw new Error(decision.reason);
    const rt = this.runtimes.get(session.runtime);
    const action = await rt.navigate(sessionId, url);
    const evidence = this.evidenceCollector.record({ sessionId, url, action: 'navigate', runtime: session.runtime, result: String((action.result as { ok?: boolean } | undefined)?.ok ?? true) });
    this.sessions.updateSession(sessionId, { tabs: [{ id: 'tab1', url }] });
    return { action, evidence };
  }

  async screenshot(sessionId: string): Promise<{ action: BrowserAction; evidence: BrowserActionEvidence }> {
    const session = this.sessions.getSession(sessionId);
    const rt = this.runtimes.get(session.runtime);
    const action = await rt.screenshot(sessionId);
    const evidence = this.evidenceCollector.record({ sessionId, url: session.tabs[0]?.url ?? '', action: 'screenshot', runtime: session.runtime, afterScreenshot: String((action.result as { data?: string } | undefined)?.data ?? '') });
    return { action, evidence };
  }

  listSessions(): readonly BrowserSession[] {
    return this.sessions.listSessions();
  }

  evidence(): readonly BrowserActionEvidence[] {
    return this.evidenceCollector.list();
  }
}
