export type StartupStatus =
  | 'uninitialized'
  | 'booting'
  | 'initializing'
  | 'starting-services'
  | 'verifying'
  | 'ready'
  | 'degraded'
  | 'failed';

/** Where the startup screen should route once startup completes. */
export type StartupDestination = 'onboarding' | 'login' | 'desktop' | 'diagnostics' | 'recovery' | 'none';

export interface StartupState {
  status: StartupStatus;
  startedAt?: string;
  readyAt?: string;
  destination: StartupDestination;
  firstBoot: boolean;
  authenticated: boolean;
  sessionReady: boolean;
  failure?: { readonly stage: StartupStatus; readonly message: string; readonly at: string };
}

export interface StartupStateInput {
  readonly firstBoot?: boolean;
  readonly authenticated?: boolean;
  readonly sessionReady?: boolean;
}

const TRANSITIONS: Readonly<Record<StartupStatus, readonly StartupStatus[]>> = {
  uninitialized: ['booting'],
  booting: ['initializing', 'failed'],
  initializing: ['starting-services', 'failed'],
  'starting-services': ['verifying', 'degraded', 'failed'],
  verifying: ['ready', 'degraded', 'failed'],
  ready: [],
  degraded: ['ready'],
  failed: ['initializing', 'booting'],
};

export function canTransitionStartup(from: StartupStatus, to: StartupStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionStartup(from: StartupStatus, to: StartupStatus): StartupStatus {
  if (!canTransitionStartup(from, to)) {
    throw new Error(`Invalid startup transition: ${from} → ${to}`);
  }
  return to;
}

/**
 * DESK-001 — Startup destination routing. The startup screen is a projection of
 * this backend state, never a client-side guess.
 */
export function resolveDestination(state: StartupState): StartupDestination {
  if (state.status === 'uninitialized') return 'onboarding';
  if (state.status === 'failed') return state.failure && state.failure.stage === 'booting' ? 'recovery' : 'diagnostics';
  if (state.status === 'degraded') return 'desktop';
  if (state.status !== 'ready') return 'none';
  if (state.firstBoot) return 'onboarding';
  if (!state.authenticated) return 'login';
  if (!state.sessionReady) return 'login';
  return 'desktop';
}

export function createStartupState(input: StartupStateInput = {}): StartupState {
  const now = new Date().toISOString();
  return {
    status: 'uninitialized',
    destination: 'onboarding',
    firstBoot: input.firstBoot ?? false,
    authenticated: input.authenticated ?? false,
    sessionReady: input.sessionReady ?? false,
    ...(input.firstBoot || input.authenticated || input.sessionReady ? { startedAt: now } : {}),
  };
}
