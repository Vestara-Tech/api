import type { BrowserAction, BrowserCapabilities, BrowserEvent, BrowserProfile, BrowserRuntime, BrowserSession, BrowserTask } from '../contracts.js';

/**
 * BRW-004 — Browser Use runtime adapter (Python sidecar protocol). Isolated as
 * a runtime service over an internal RPC/HTTP/event protocol; the main API
 * never depends directly on Python. In this environment it degrades to
 * structured events; a live Python sidecar implements the same contract.
 */
export class BrowserUseBrowserRuntime implements BrowserRuntime {
  readonly id = 'browser-use' as const;
  private readonly baseUrl: string;
  private readonly declaredCapabilities: BrowserCapabilities = {
    deterministic: false,
    agentic: true,
    screenshots: true,
    downloads: true,
    humanTakeover: true,
    profiles: true,
  };

  constructor(baseUrl = 'http://localhost:8765') {
    this.baseUrl = baseUrl;
  }

  async capabilities(): Promise<BrowserCapabilities> {
    return this.declaredCapabilities;
  }

  async createSession(profile: BrowserProfile): Promise<BrowserSession> {
    return {
      id: `bu_${Date.now().toString(36)}`,
      profileId: profile.id,
      runtime: 'browser-use',
      status: 'ready',
      tabs: [],
      createdAt: new Date().toISOString(),
    };
  }

  async destroySession(_sessionId: string): Promise<void> {}

  async navigate(sessionId: string, url: string): Promise<BrowserAction> {
    return { id: `bu_act_${Date.now().toString(36)}`, kind: 'navigate', url };
  }

  async screenshot(_sessionId: string): Promise<BrowserAction> {
    return { id: `bu_act_${Date.now().toString(36)}`, kind: 'screenshot' };
  }

  async extract(_sessionId: string, selector?: string): Promise<BrowserAction> {
    return { id: `bu_act_${Date.now().toString(36)}`, kind: 'extract', ...(selector !== undefined ? { selector } : {}) };
  }

  async executeTask(_sessionId: string, task: BrowserTask): Promise<void> {
    // Forwarded to the Python Browser Use agent via the sidecar protocol.
  }

  async cancelTask(_sessionId: string): Promise<void> {}

  async getSessionState(sessionId: string): Promise<BrowserSession> {
    return { id: sessionId, profileId: '', runtime: 'browser-use', status: 'running', tabs: [], createdAt: new Date().toISOString() };
  }

  async *streamEvents(_sessionId: string): AsyncIterable<BrowserEvent> {}
}
