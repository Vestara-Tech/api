/** BRW-001 — Browser Module contracts. */

export type BrowserRuntimeId = 'playwright' | 'browser-use' | 'cdp';

export interface BrowserCapabilities {
  readonly deterministic: boolean;
  readonly agentic: boolean;
  readonly screenshots: boolean;
  readonly downloads: boolean;
  readonly humanTakeover: boolean;
  readonly profiles: boolean;
}

export interface BrowserProfile {
  readonly id: string;
  readonly name: string;
  readonly runtime: BrowserRuntimeId;
  readonly browser: 'chromium' | 'firefox' | 'webkit';
  readonly headless: boolean;
  readonly allowedDomains?: readonly string[];
  readonly blockedDomains?: readonly string[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type BrowserSessionStatus = 'created' | 'starting' | 'ready' | 'running' | 'waiting-human' | 'completed' | 'failed' | 'cancelled' | 'timed-out';

export interface BrowserSession {
  readonly id: string;
  readonly profileId: string;
  readonly runtime: BrowserRuntimeId;
  readonly status: BrowserSessionStatus;
  readonly tabs: readonly { id: string; url: string; title?: string }[];
  readonly createdAt: string;
}

export type BrowserActionKind =
  | 'navigate' | 'back' | 'forward' | 'reload' | 'click' | 'type' | 'select' | 'scroll'
  | 'inspect' | 'extract' | 'screenshot' | 'wait' | 'execute-script' | 'download';

export interface BrowserAction {
  readonly id: string;
  readonly kind: BrowserActionKind;
  readonly url?: string;
  readonly selector?: string;
  readonly text?: string;
  readonly script?: string;
  readonly result?: unknown;
  readonly error?: string;
}

export interface BrowserTask {
  readonly id: string;
  readonly sessionId: string;
  readonly goal: string;
  readonly status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  readonly stepLimit: number;
  readonly currentStep: number;
  readonly model?: string;
}

export type BrowserEventType =
  | 'session.created' | 'session.ready' | 'session.closed' | 'session.failed'
  | 'task.started' | 'task.step' | 'task.completed' | 'task.failed' | 'task.cancelled'
  | 'action.started' | 'action.completed' | 'action.failed'
  | 'navigated' | 'screenshot.captured' | 'waiting-human' | 'human-resumed';

export interface BrowserEvent {
  readonly type: BrowserEventType;
  readonly at: string;
  readonly sessionId?: string;
  readonly taskId?: string;
  readonly action?: BrowserAction;
  readonly data?: unknown;
}

export interface BrowserActionEvidence {
  readonly sessionId: string;
  readonly taskId?: string;
  readonly workflowId?: string;
  readonly agentId?: string;
  readonly url: string;
  readonly title?: string;
  readonly action: string;
  readonly beforeScreenshot?: string;
  readonly afterScreenshot?: string;
  readonly domSnapshot?: string;
  readonly extractedData?: unknown;
  readonly timestamp: string;
  readonly durationMs?: number;
  readonly runtime: BrowserRuntimeId;
  readonly result?: string;
}

/** BRW-001 — BrowserRuntime contract (Vestara-owned; Browser Use is a runtime). */
export interface BrowserRuntime {
  readonly id: BrowserRuntimeId;
  capabilities(): Promise<BrowserCapabilities>;
  createSession(profile: BrowserProfile): Promise<BrowserSession>;
  destroySession(sessionId: string): Promise<void>;
  navigate(sessionId: string, url: string): Promise<BrowserAction>;
  screenshot(sessionId: string): Promise<BrowserAction>;
  extract(sessionId: string, selector?: string): Promise<BrowserAction>;
  executeTask(sessionId: string, task: BrowserTask): Promise<void>;
  cancelTask(sessionId: string): Promise<void>;
  getSessionState(sessionId: string): Promise<BrowserSession>;
  streamEvents(sessionId: string): AsyncIterable<BrowserEvent>;
}
