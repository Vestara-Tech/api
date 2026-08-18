import { hashOf } from '../../generator/domain/hash.js';

export type ExecutionStatus =
  | 'requested'
  | 'analyzing'
  | 'planning'
  | 'awaiting-approval'
  | 'queued'
  | 'running'
  | 'blocked'
  | 'reviewing'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ExecutionIntentKind = 'generate' | 'build' | 'modify' | 'fix' | 'test' | 'verify' | 'inspect' | 'configure';
export type ExecutionComplexity = 'simple' | 'standard' | 'complex';
export type ExecutionRole = 'planner' | 'developer' | 'reviewer' | 'verifier' | 'observer';

export interface IntentAmbiguity {
  readonly code: string;
  readonly message: string;
}

export interface ResolvedIntent {
  readonly kind: ExecutionIntentKind;
  readonly target: string;
  readonly confidence: number;
  readonly complexity: ExecutionComplexity;
  readonly ambiguities: readonly IntentAmbiguity[];
  readonly requiredCapabilities: readonly string[];
}

export interface ResolvedCapability {
  readonly namespace: string;
  readonly version: string;
  readonly permissions: readonly string[];
  readonly operations: readonly string[];
}

export interface ExecutionRequest {
  readonly id: string;
  readonly goal: string;
  readonly agentId: string;
  readonly agentName?: string;
  readonly roomId: string;
  readonly principalId?: string;
  readonly requestedAt: string;
}

export interface ExecutionStep {
  readonly id: string;
  readonly title: string;
  readonly role: ExecutionRole;
  readonly capability: string;
  readonly operation: string;
  readonly requiresApproval: boolean;
  readonly evidence: readonly string[];
}

export interface ExecutionMilestone {
  readonly id: string;
  readonly title: string;
  readonly steps: readonly ExecutionStep[];
}

export interface ExecutionPlan {
  readonly id: string;
  readonly executionId: string;
  readonly status: ExecutionStatus;
  readonly request: ExecutionRequest;
  readonly intent: ResolvedIntent;
  readonly capabilities: readonly ResolvedCapability[];
  readonly milestones: readonly ExecutionMilestone[];
  readonly evidence: readonly string[];
  readonly warnings: readonly string[];
  readonly summary: string;
  readonly generatedAt: string;
}

export interface ExecutionLease {
  readonly id: string;
  readonly executionId: string;
  readonly holder: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
}

export interface ExecutionEvent {
  readonly id: string;
  readonly executionId: string;
  readonly type: 'requested' | 'intent-resolved' | 'capabilities-resolved' | 'plan-composed' | 'planning-refreshed'
    | 'execution-started' | 'context-assembled' | 'runtime-connected' | 'tool-approved'
    | 'file-changed' | 'execution-completed' | 'verification-started' | 'verification-completed'
    | 'evidence-recorded' | 'execution-failed' | 'execution-cancelled';
  readonly at: string;
  readonly actorId?: string;
  readonly detail?: string;
}

export interface Execution {
  readonly id: string;
  readonly request: ExecutionRequest;
  readonly status: ExecutionStatus;
  readonly plan: ExecutionPlan;
  readonly events: readonly ExecutionEvent[];
  readonly lease?: ExecutionLease;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly result?: 'pass' | 'fail' | 'indeterminate';
  readonly evidence?: string | null;
}

export interface ExecutionPreview extends ExecutionPlan {}

export interface ExecutionPreviewInput {
  readonly goal: string;
  readonly agentId: string;
  readonly roomId?: string;
  readonly principalId?: string;
}

export function createExecutionId(input: { readonly goal: string; readonly agentId: string; readonly roomId: string }): string {
  return `exec_${hashOf(input).slice(0, 12)}`;
}

export function createPlanId(input: { readonly executionId: string; readonly goal: string; readonly agentId: string; readonly kind: ExecutionIntentKind }): string {
  return `plan_${hashOf(input).slice(0, 12)}`;
}
