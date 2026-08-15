import { BrowserSessionManager } from '../browser/session/browser-session-manager.js';
import { BrowserRuntimeRegistry } from '../browser/registry/browser-runtime-registry.js';
import { BrowserPolicyGateway } from '../browser/policy/browser-policy-gateway.js';
import { BrowserEvidenceCollector } from '../browser/evidence/browser-evidence-collector.js';
import { BrowserService } from '../browser/service/browser-service.js';
import { PlaywrightBrowserRuntime } from '../browser/runtimes/playwright.js';
import { BrowserUseBrowserRuntime } from '../browser/runtimes/browser-use.js';

export interface BrowserPlatform {
  readonly sessions: BrowserSessionManager;
  readonly runtimes: BrowserRuntimeRegistry;
  readonly policy: BrowserPolicyGateway;
  readonly evidence: BrowserEvidenceCollector;
  readonly service: BrowserService;
}

/** BRW — Composition root. Registers Playwright (deterministic) + Browser Use (agentic). */
export function buildBrowserPlatform(): BrowserPlatform {
  const sessions = new BrowserSessionManager();
  const runtimes = new BrowserRuntimeRegistry();
  runtimes.register(new PlaywrightBrowserRuntime());
  runtimes.register(new BrowserUseBrowserRuntime());
  const policy = new BrowserPolicyGateway();
  const evidence = new BrowserEvidenceCollector();
  const service = new BrowserService({ sessions, runtimes, policy, evidence });
  return { sessions, runtimes, policy, evidence, service };
}
