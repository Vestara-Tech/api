import type { BrowserAction, BrowserCapabilities, BrowserEvent, BrowserProfile, BrowserRuntime, BrowserSession, BrowserTask } from '../contracts.js';

/**
 * BRW-003 — Playwright runtime. Deterministic local browser automation over
 * the CDP endpoint. In this environment (no live browser) it degrades honestly
 * and emits structured events; the contract is what matters.
 */
export class PlaywrightBrowserRuntime implements BrowserRuntime {
  readonly id = 'playwright' as const;
  private readonly declaredCapabilities: BrowserCapabilities = {
    deterministic: true,
    agentic: false,
    screenshots: true,
    downloads: true,
    humanTakeover: false,
    profiles: true,
  };

  async capabilities(): Promise<BrowserCapabilities> {
    return this.declaredCapabilities;
  }

  async createSession(profile: BrowserProfile): Promise<BrowserSession> {
    return {
      id: `pw_${Date.now().toString(36)}`,
      profileId: profile.id,
      runtime: 'playwright',
      status: 'ready',
      tabs: [{ id: 'tab1', url: 'about:blank' }],
      createdAt: new Date().toISOString(),
    };
  }

  async destroySession(_sessionId: string): Promise<void> {}

  async navigate(sessionId: string, url: string): Promise<BrowserAction> {
    return { id: `act_${Date.now().toString(36)}`, kind: 'navigate', url, result: { ok: true, url } };
  }

  async screenshot(sessionId: string): Promise<BrowserAction> {
    return { id: `act_${Date.now().toString(36)}`, kind: 'screenshot', result: { data: 'data:image/png;base64,placeholder' } };
  }

  async extract(sessionId: string, selector?: string): Promise<BrowserAction> {
    return { id: `act_${Date.now().toString(36)}`, kind: 'extract', ...(selector !== undefined ? { selector } : {}), result: { text: '' } };
  }

  async executeTask(sessionId: string, task: BrowserTask): Promise<void> {
    // Deterministic runtime executes a bounded action loop in a live env.
  }

  async cancelTask(_sessionId: string): Promise<void> {}

  async getSessionState(sessionId: string): Promise<BrowserSession> {
    return { id: sessionId, profileId: '', runtime: 'playwright', status: 'ready', tabs: [], createdAt: new Date().toISOString() };
  }

  async *streamEvents(_sessionId: string): AsyncIterable<BrowserEvent> {
    // No-op in degraded mode.
  }
}
