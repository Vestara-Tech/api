/** WF-001/002 — Workflow domain contracts. */

export type WorkflowStepKind =
  | 'agent'
  | 'tool'
  | 'service'
  | 'approval'
  | 'condition'
  | 'parallel'
  | 'subworkflow'
  | 'verification'
  | 'delay';

export type WorkflowStatus = 'draft' | 'published' | 'superseded';

export interface WorkflowInput {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'json';
  readonly required: boolean;
  readonly default?: unknown;
}

export interface WorkflowVariable {
  readonly name: string;
  readonly expression: string;
}

export type WorkflowTrigger =
  | { readonly kind: 'manual' }
  | { readonly kind: 'api' }
  | { readonly kind: 'event'; readonly eventType: string }
  | { readonly kind: 'schedule'; readonly cron: string };

export interface StepOutputBinding {
  readonly sourceStep: string;
  readonly outputName: string;
}

export interface AgentStepConfig {
  readonly agentId: string;
  readonly objective: string;
  readonly inputBindings?: Readonly<Record<string, string>>;
  readonly skills?: readonly string[];
}

export interface ToolStepConfig {
  readonly toolId: string;
  readonly input?: unknown;
  readonly requiresApproval?: boolean;
}

export interface ServiceStepConfig {
  readonly service: string;
  readonly operation: string;
  readonly input?: unknown;
}

export interface ApprovalStepConfig {
  readonly approver: 'human' | 'system' | 'policy';
  readonly subject: string;
  readonly timeoutSeconds?: number;
}

export interface ConditionStepConfig {
  readonly expression: string;
  readonly trueStep?: string;
  readonly falseStep?: string;
}

export interface ParallelStepConfig {
  readonly branches: readonly WorkflowStepDefinition[];
  readonly maxConcurrency?: number;
}

export interface SubworkflowStepConfig {
  readonly workflowId: string;
  readonly version?: string;
  readonly inputBindings?: Readonly<Record<string, string>>;
}

export interface VerificationStepConfig {
  readonly requirements: readonly string[];
  readonly requireEvidence: boolean;
}

export interface DelayStepConfig {
  readonly seconds: number;
}

export interface WorkflowStepDefinition {
  readonly id: string;
  readonly kind: WorkflowStepKind;
  readonly name: string;
  readonly description?: string;
  readonly dependsOn?: readonly string[];
  readonly agent?: AgentStepConfig;
  readonly tool?: ToolStepConfig;
  readonly service?: ServiceStepConfig;
  readonly approval?: ApprovalStepConfig;
  readonly condition?: ConditionStepConfig;
  readonly parallel?: ParallelStepConfig;
  readonly subworkflow?: SubworkflowStepConfig;
  readonly verification?: VerificationStepConfig;
  readonly delay?: DelayStepConfig;
  readonly retry?: { readonly maxAttempts: number; readonly backoffSeconds: number };
  readonly timeoutSeconds?: number;
  readonly onFailure?: 'suspend' | 'fail' | 'retry';
  readonly skipIf?: string;
}

export interface WorkflowDefinition {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly description?: string;
  readonly inputs: readonly WorkflowInput[];
  readonly variables: readonly WorkflowVariable[];
  readonly triggers: readonly WorkflowTrigger[];
  readonly steps: readonly WorkflowStepDefinition[];
  readonly outputs?: readonly StepOutputBinding[];
  readonly status: WorkflowStatus;
  readonly revision: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CreateWorkflowInput {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly inputs?: readonly WorkflowInput[];
  readonly variables?: readonly WorkflowVariable[];
  readonly triggers?: readonly WorkflowTrigger[];
  readonly steps: readonly WorkflowStepDefinition[];
  readonly outputs?: readonly StepOutputBinding[];
}

/** WF-004 — Execution state machine. */
export type WorkflowRunStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'suspended';

export type WorkflowStepRunStatus =
  | 'pending'
  | 'queued'
  | 'running'
  | 'waiting'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped';

export interface WorkflowStepRun {
  readonly stepId: string;
  readonly name: string;
  readonly kind: WorkflowStepKind;
  readonly status: WorkflowStepRunStatus;
  readonly attempts: number;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly result?: unknown;
  readonly error?: string;
  readonly waitingFor?: string;
}

export interface WorkflowRun {
  readonly id: string;
  readonly workflowId: string;
  readonly version: string;
  readonly status: WorkflowRunStatus;
  readonly inputs: Readonly<Record<string, unknown>>;
  readonly context: Readonly<Record<string, unknown>>;
  readonly steps: readonly WorkflowStepRun[];
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly error?: string;
  readonly waitingOnStep?: string;
  readonly evidence?: Readonly<Record<string, string>>;
}
