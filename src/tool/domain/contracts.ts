/** TOOL-001 — Tool platform contracts. */

export type ToolRisk = 'read' | 'write' | 'control' | 'privileged' | 'critical';

export type ToolApprovalMode = 'auto' | 'always';

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  readonly id: string;
  readonly version: string;
  readonly description: string;
  readonly inputSchema: unknown;
  readonly outputSchema: unknown;
  readonly capabilities: readonly string[];
  readonly risk: ToolRisk;
  readonly approval?: ToolApprovalMode;
  execute(context: ToolExecutionContext, input: TInput): Promise<ToolResult<TOutput>>;
}

export interface ToolExecutionContext {
  readonly agentId: string;
  readonly runId: string;
  readonly skillId?: string;
  readonly principalId: string;
  readonly authorizedBy?: string;
}

export interface ToolResult<TOutput = unknown> {
  readonly ok: boolean;
  readonly output?: TOutput;
  readonly error?: string;
  readonly durationMs: number;
  readonly evidence?: string;
}

/** A capability made available to agents as a tool. */
export interface ToolContribution {
  readonly toolId: string;
  readonly version: string;
  readonly description: string;
  readonly inputSchema: unknown;
  readonly outputSchema: unknown;
  readonly capabilities: readonly string[];
  readonly risk: ToolRisk;
  readonly handler: (context: ToolExecutionContext, input: unknown) => Promise<unknown>;
}

export interface ToolExecutionRecord {
  readonly executionId: string;
  readonly toolId: string;
  readonly runId: string;
  readonly agentId: string;
  readonly skillId?: string;
  readonly capability: string;
  readonly principalId: string;
  readonly authorizedBy?: string;
  readonly risk: ToolRisk;
  readonly approvalRequired: boolean;
  readonly approved: boolean;
  readonly status: 'executed' | 'denied' | 'failed' | 'suspended';
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly durationMs?: number;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly error?: string;
  readonly evidence?: string;
}

/** TOOL-005 — Risk evaluation result. */
export interface ToolAuthorizationDecision {
  readonly allowed: boolean;
  readonly approvalRequired: boolean;
  readonly reason: string;
}
