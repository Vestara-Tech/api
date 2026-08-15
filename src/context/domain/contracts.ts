/** CTX-001/002 — Context Module domain contracts. */

export type ContextSourceKind =
  | 'instruction'
  | 'goal'
  | 'conversation'
  | 'workflow'
  | 'task'
  | 'file'
  | 'code'
  | 'git'
  | 'skill'
  | 'tool'
  | 'memory'
  | 'evidence'
  | 'configuration'
  | 'integration'
  | 'system'
  | 'user';

export interface ContextItem {
  readonly id: string;
  readonly source: ContextSourceKind;
  readonly sourceId?: string;
  readonly title?: string;
  readonly content: string;
  readonly priority: number;
  readonly relevance?: number;
  readonly tokenEstimate?: number;
  readonly required: boolean;
  readonly sensitive: boolean;
  readonly metadata: Readonly<Record<string, unknown>>;
}

export type ContextScope =
  | 'system'
  | 'organization'
  | 'workspace'
  | 'project'
  | 'workflow'
  | 'run'
  | 'agent'
  | 'task'
  | 'turn';

export const CONTEXT_SCOPE_ORDER: readonly ContextScope[] = [
  'system',
  'organization',
  'workspace',
  'project',
  'workflow',
  'run',
  'agent',
  'task',
  'turn',
];

export type ContextPurpose = 'agent-execution' | 'workflow-step' | 'retrieval' | 'observation' | 'debugging';

export interface ContextBudget {
  readonly maximumTokens: number;
  readonly reservedOutputTokens: number;
  readonly reservedSystemTokens: number;
  readonly availableContextTokens: number;
}

export interface ContextProvenance {
  readonly itemId: string;
  readonly source: ContextSourceKind;
  readonly sourceId?: string;
  readonly scope: ContextScope;
}

export interface ContextBundle {
  readonly id: string;
  readonly purpose: ContextPurpose;
  readonly items: readonly ContextItem[];
  readonly budget: ContextBudget;
  readonly provenance: readonly ContextProvenance[];
  readonly createdAt: string;
}

export interface ContextSnapshotItem {
  readonly itemId: string;
  readonly source: ContextSourceKind;
  readonly scope: ContextScope;
  readonly tokenEstimate: number;
}

export interface ContextSnapshot {
  readonly id: string;
  readonly bundleHash: string;
  readonly runId?: string;
  readonly agentId?: string;
  readonly workflowRunId?: string;
  readonly items: readonly ContextSnapshotItem[];
  readonly createdAt: string;
}

export interface ContextCollectionRequest {
  readonly purpose: ContextPurpose;
  readonly principalId: string;
  readonly scope: ContextScope;
  readonly agentId?: string;
  readonly workflowRunId?: string;
  readonly task?: string;
  readonly maxTokens?: number;
}

export interface TokenBudgetAllocation {
  readonly source: ContextSourceKind;
  readonly tokens: number;
}
