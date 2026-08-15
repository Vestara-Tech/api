export type InstallationStatus =
  | 'uninitialized'
  | 'bootstrap'
  | 'planning'
  | 'awaiting-approval'
  | 'configuring'
  | 'verifying'
  | 'ready'
  | 'failed';

export interface InstallationState {
  readonly installationId: string;
  readonly status: InstallationStatus;
  readonly onboardingVersion: string;
  readonly currentStep?: string;
  readonly completedSteps: readonly string[];
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly failure?: { readonly step: string; readonly message: string; readonly at: string };
}

export interface CreateInstallationStateInput {
  readonly installationId: string;
  readonly onboardingVersion: string;
  readonly status?: InstallationStatus;
}

/**
 * ONB-001 — Explicit installation state machine.
 *
 * Never infer first-run status from "no users". The state is durable and
 * drives recovery/upgrades.
 *
 *   uninitialized → bootstrap → planning → awaiting-approval → configuring
 *   → verifying → ready
 *
 * Any execution state can transition to `failed`, then retry / resume /
 * rollback.
 */
const TRANSITIONS: Readonly<Record<InstallationStatus, readonly InstallationStatus[]>> = {
  uninitialized: ['bootstrap'],
  bootstrap: ['planning', 'failed'],
  planning: ['awaiting-approval', 'failed'],
  'awaiting-approval': ['planning', 'configuring', 'failed'],
  configuring: ['verifying', 'failed'],
  verifying: ['ready', 'configuring', 'failed'],
  ready: [],
  failed: ['planning', 'configuring', 'ready'],
};

export function canTransitionInstallation(from: InstallationStatus, to: InstallationStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionInstallation(from: InstallationStatus, to: InstallationStatus): InstallationStatus {
  if (!canTransitionInstallation(from, to)) {
    throw new Error(`Invalid installation state transition: ${from} → ${to}`);
  }
  return to;
}

export function isTerminalInstallation(status: InstallationStatus): boolean {
  return status === 'ready';
}

export function createInstallationState(input: CreateInstallationStateInput): InstallationState {
  const now = new Date().toISOString();
  return {
    installationId: input.installationId,
    status: input.status ?? 'uninitialized',
    onboardingVersion: input.onboardingVersion,
    completedSteps: [],
    ...(input.status === 'uninitialized' || input.status === undefined ? {} : { startedAt: now }),
  };
}
