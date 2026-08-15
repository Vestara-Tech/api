/** AGENT-001 — Agent platform contracts. */

export type AgentRole =
  | 'planner'
  | 'developer'
  | 'reviewer'
  | 'verifier'
  | 'observer'
  | 'assistant'
  | 'specialist'
  | 'custom';

export interface AgentModelPolicy {
  readonly mode: 'fixed' | 'auto';
  readonly provider?: string;
  readonly model?: string;
  readonly requirements?: {
    readonly reasoning?: boolean;
    readonly tools?: boolean;
    readonly structuredOutput?: boolean;
    readonly vision?: boolean;
    readonly minContext?: number;
  };
  readonly optimizeFor?: 'quality' | 'balanced' | 'cost' | 'latency' | 'local';
}

export interface AgentInstructions {
  readonly system: string;
  readonly guardrails?: readonly string[];
}

export interface ToolSelector {
  readonly id: string;
  readonly approval?: 'auto' | 'always';
}

export interface SkillSelector {
  readonly id: string;
  readonly optional?: boolean;
}

export interface AgentExecutionPolicy {
  readonly maxSteps: number;
  readonly maxToolCalls: number;
  readonly allowDelegation: boolean;
  readonly maxConcurrentChildren: number;
  readonly maxDepth: number;
}

export interface AgentDefinition {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description?: string;
  readonly role: AgentRole;
  readonly model: AgentModelPolicy;
  readonly instructions: AgentInstructions;
  readonly tools: readonly ToolSelector[];
  readonly skills: readonly SkillSelector[];
  readonly permissions: readonly string[];
  readonly execution: AgentExecutionPolicy;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/** Agent run lifecycle (AGENT-004). */
export type AgentRunStatus =
  | 'queued'
  | 'preparing'
  | 'running'
  | 'waiting-for-tool'
  | 'waiting-for-approval'
  | 'suspended'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface AgentRun {
  readonly id: string;
  readonly agentId: string;
  readonly status: AgentRunStatus;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly currentStep?: number;
  readonly totalSteps?: number;
  readonly result?: string;
  readonly error?: string;
  readonly approvalRequired?: string;
}

export interface AgentRunEvent {
  readonly runId: string;
  readonly type: 'started' | 'tool-call' | 'tool-result' | 'step' | 'approval-requested' | 'completed' | 'failed' | 'cancelled' | 'suspended';
  readonly at: string;
  readonly data?: unknown;
}

export interface DelegationPolicy {
  readonly allowed: boolean;
  readonly allowedAgents?: readonly string[];
  readonly maxDepth: number;
  readonly maxConcurrentChildren: number;
  readonly inheritContext: boolean;
  readonly inheritPermissions: false;
}
