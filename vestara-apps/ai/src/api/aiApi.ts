import type { AiGenerateRequest, AiStreamEvent } from '@vestara/ai-ui/src/api/contracts';

export interface AgentRunEventShape {
  readonly runId: string;
  readonly type: string;
  readonly at: string;
  readonly data?: unknown;
}

export interface VerificationGraphIssueShape {
  readonly severity: 'error' | 'warning' | 'info';
  readonly code: string;
  readonly message: string;
  readonly module?: string;
  readonly dependency?: string;
  readonly alias?: string;
  readonly path?: string;
}

export interface VerificationReportShape {
  readonly version: 1;
  readonly level: string;
  readonly scope: string;
  readonly changedFiles: readonly string[];
  readonly affectedModules: readonly string[];
  readonly selectedTests: readonly string[];
  readonly executedTests: readonly string[];
  readonly reusedTests: readonly string[];
  readonly skippedTests: readonly string[];
  readonly passed: number;
  readonly failed: number;
  readonly cached: number;
  readonly escalated: boolean;
  readonly escalationReasons: readonly string[];
  readonly durationMs: number;
  readonly graphValid: boolean;
  readonly graphIssues: readonly VerificationGraphIssueShape[];
  readonly result: 'pass' | 'fail' | 'indeterminate';
  readonly verified: boolean;
  readonly evidence: string | null;
  readonly reportPath?: string;
  readonly fingerprint?: string | null;
}

export interface ActivityRoomAgentShape {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly toolCount: number;
  readonly skillCount: number;
  readonly permissions: readonly string[];
  readonly latestRunId: string | null;
  readonly latestRunStatus: string | null;
  readonly latestRunAt: string | null;
}

export interface ActivityRoomRunShape {
  readonly id: string;
  readonly agentId: string;
  readonly status: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly result?: string;
  readonly error?: string;
}

export interface ActivityRoomWorkflowRunShape {
  readonly id: string;
  readonly workflowId: string;
  readonly status: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly waitingOnStep?: string;
  readonly error?: string;
}

export interface ActivityRoomApprovalShape {
  readonly id: string;
  readonly runId: string;
  readonly agentId: string;
  readonly toolId: string;
  readonly subject: string;
  readonly risk: string;
  readonly status: string;
  readonly requestedAt: string;
  readonly decidedAt?: string;
  readonly decidedBy?: string;
}

export interface ActivityRoomTimelineItemShape {
  readonly id: string;
  readonly kind: 'agent-run' | 'workflow-run' | 'approval' | 'verification' | 'execution';
  readonly title: string;
  readonly detail: string;
  readonly status: string;
  readonly at: string;
}

export interface ActivityRoomExecutionIntentShape {
  readonly kind: 'generate' | 'build' | 'modify' | 'fix' | 'test' | 'verify' | 'inspect' | 'configure';
  readonly target: string;
  readonly confidence: number;
  readonly complexity: 'simple' | 'standard' | 'complex';
  readonly ambiguities: readonly { code: string; message: string }[];
  readonly requiredCapabilities: readonly string[];
}

export interface ActivityRoomExecutionRequestShape {
  readonly id: string;
  readonly goal: string;
  readonly agentId: string;
  readonly agentName?: string;
  readonly roomId: string;
  readonly principalId?: string;
  readonly requestedAt: string;
}

export interface ActivityRoomExecutionCapabilityShape {
  readonly namespace: string;
  readonly version: string;
  readonly permissions: readonly string[];
  readonly operations: readonly string[];
}

export interface ActivityRoomExecutionStepShape {
  readonly id: string;
  readonly title: string;
  readonly role: 'planner' | 'developer' | 'reviewer' | 'verifier' | 'observer';
  readonly capability: string;
  readonly operation: string;
  readonly requiresApproval: boolean;
  readonly evidence: readonly string[];
}

export interface ActivityRoomExecutionMilestoneShape {
  readonly id: string;
  readonly title: string;
  readonly steps: readonly ActivityRoomExecutionStepShape[];
}

export interface ActivityRoomExecutionPlanShape {
  readonly id: string;
  readonly executionId: string;
  readonly status: string;
  readonly request: ActivityRoomExecutionRequestShape;
  readonly intent: ActivityRoomExecutionIntentShape;
  readonly capabilities: readonly ActivityRoomExecutionCapabilityShape[];
  readonly milestones: readonly ActivityRoomExecutionMilestoneShape[];
  readonly evidence: readonly string[];
  readonly warnings: readonly string[];
  readonly summary: string;
  readonly generatedAt: string;
}

export interface ActivityRoomExecutionRecordShape {
  readonly id: string;
  readonly status: string;
  readonly request: ActivityRoomExecutionRequestShape;
  readonly plan: ActivityRoomExecutionPlanShape;
  readonly eventCount: number;
  readonly lease?: {
    readonly id: string;
    readonly executionId: string;
    readonly holder: string;
    readonly issuedAt: string;
    readonly expiresAt: string;
  };
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly result?: 'pass' | 'fail' | 'indeterminate';
  readonly evidence?: string | null;
}

export interface ActivityRoomSnapshotShape {
  readonly generatedAt: string;
  readonly counts: {
    readonly agents: number;
    readonly agentRuns: number;
    readonly activeAgentRuns: number;
    readonly approvals: number;
    readonly pendingApprovals: number;
    readonly workflows: number;
    readonly workflowRuns: number;
    readonly activeWorkflowRuns: number;
  };
  readonly agents: readonly ActivityRoomAgentShape[];
  readonly agentRuns: readonly ActivityRoomRunShape[];
  readonly approvals: readonly ActivityRoomApprovalShape[];
  readonly workflowDefinitions: readonly { id: string; name: string; version: string; status: string; revision: number }[];
  readonly workflowRuns: readonly ActivityRoomWorkflowRunShape[];
  readonly verification: {
    readonly level: string;
    readonly result: 'pass' | 'fail' | 'indeterminate';
    readonly scope: string;
    readonly graphValid: boolean;
    readonly selectedTests: number;
    readonly executedTests: number;
    readonly cached: number;
    readonly durationMs: number;
    readonly evidence: string | null;
    readonly fingerprint?: string | null;
  } | null;
  readonly timeline: readonly ActivityRoomTimelineItemShape[];
}

export interface ActivityRoomPreviewRequestShape {
  readonly goal: string;
  readonly agentId?: string;
  readonly principalId?: string;
}

export interface ActivityRoomRunResultShape {
  readonly executionId: string;
  readonly complexity: 'simple' | 'standard' | 'complex';
  readonly route: 'developer' | 'workflow';
  readonly status: string;
}

export interface ActivityRoomRunRequestShape {
  readonly goal: string;
  readonly principalId?: string;
}

export interface ActivityExecutionSummaryShape {
  readonly executionId: string;
  readonly goal: string;
  readonly complexity: 'simple' | 'standard' | 'complex';
  readonly status: string;
  readonly participants: readonly string[];
  readonly verification: {
    readonly conclusion: 'pass' | 'fail' | 'indeterminate' | 'pending';
    readonly handoffEligible: boolean;
  };
  readonly changedFileCount: number;
  readonly startedAt: string;
  readonly updatedAt: string;
}

export interface ActivityHistoryPageShape {
  readonly items: readonly ActivityExecutionSummaryShape[];
  readonly nextCursor?: string;
  readonly hasMore: boolean;
}

export interface ActivityHistoryQueryShape {
  readonly goal?: string;
  readonly status?: readonly string[];
  readonly complexity?: readonly ('simple' | 'standard' | 'complex')[];
  readonly agentId?: string;
  readonly workflowId?: string;
  readonly verification?: readonly ('pass' | 'fail' | 'indeterminate' | 'pending')[];
  readonly from?: string;
  readonly to?: string;
  readonly sort?: 'newest' | 'oldest';
  readonly cursor?: string;
  readonly limit?: number;
}

export interface ActivityHistoryEventShape {
  readonly id: string;
  readonly executionId: string;
  readonly sequence: number;
  readonly occurredAt: string;
  readonly type: string;
  readonly payload?: unknown;
}

// ── ARX-013 Inspector v2 DTOs ────────────────────────────────────────

export interface ActivityInspectorOverviewShape {
  readonly executionId: string;
  readonly goal: string;
  readonly status: string;
  readonly phase: string;
  readonly complexity: string;
  readonly participants: readonly { readonly role: string; readonly agentId: string; readonly status: string }[];
  readonly workflowId?: string;
  readonly workflowRunId?: string;
  readonly startedAt?: string;
  readonly updatedAt: string;
  readonly completedAt?: string;
}

export interface ActivityInspectorRuntimeShape {
  readonly runtimeId?: string;
  readonly provider?: string;
  readonly model?: string;
  readonly sessionId?: string;
  readonly health: 'connected' | 'unknown' | 'unavailable';
}

export interface ActivityInspectorContextShape {
  readonly categories: readonly string[];
  readonly skills: readonly { readonly id: string; readonly version?: string }[];
  readonly resourceCount: number;
  readonly provenance: readonly string[];
}

export interface ActivityInspectorChangesShape {
  readonly fileCount: number;
  readonly files: readonly { readonly path: string; readonly status: string; readonly additions?: number; readonly deletions?: number }[];
}

export interface ActivityInspectorVerificationShape {
  readonly status: string;
  readonly conclusion?: string;
  readonly freshness?: string;
  readonly level?: string;
  readonly selectedTests: number;
  readonly executedTests: number;
  readonly cached: number;
  readonly fingerprint?: string;
  readonly reasons: readonly string[];
  readonly handoffEligible: boolean;
}

export interface ActivityInspectorEvidenceShape {
  readonly status: string;
  readonly hash?: string;
  readonly outcome?: string;
  readonly recordedAt?: string;
}

export interface ActivityInspectorTimelineEntryShape {
  readonly sequence: number;
  readonly type: string;
  readonly title: string;
  readonly detail?: string;
  readonly at: string;
}

export interface ActivityInspectorViewShape {
  readonly executionId: string;
  readonly goal: string;
  readonly overview: ActivityInspectorOverviewShape;
  readonly runtime: ActivityInspectorRuntimeShape;
  readonly context: ActivityInspectorContextShape;
  readonly changes: ActivityInspectorChangesShape;
  readonly verification: ActivityInspectorVerificationShape;
  readonly evidence: ActivityInspectorEvidenceShape;
  readonly timeline: readonly ActivityInspectorTimelineEntryShape[];
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(path, { ...init, headers });
  const body = (await response.json().catch(() => null)) as unknown;
  if (!response.ok) {
    const err = body as { error?: { message?: string } } | null;
    throw new Error(err?.error?.message ?? `HTTP ${response.status}`);
  }
  return body as T;
}

export const aiApi = {
  agents: () => request<{ id: string; name: string; role: string }[]>('/api/v2/agents'),

  startAgentRun: (agentId: string, goal: string, principalId?: string) =>
    request<{ id: string; agentId: string; status: string }>('/api/v2/agent-runs', {
      method: 'POST',
      body: JSON.stringify({ agentId, goal, ...(principalId !== undefined ? { principalId } : {}) }),
    }),

  agentRunEvents: (runId: string) => request<readonly AgentRunEventShape[]>(`/api/v2/agent-runs/${runId}/events`),

  approvals: () =>
    request<{ id: string; runId: string; agentId: string; toolId: string; subject: string; risk: string; status: string }[]>('/api/v2/approvals'),

  verificationLatest: () => request<VerificationReportShape | null>('/api/v2/verification/latest'),

  activityRoomSnapshot: () => request<ActivityRoomSnapshotShape>('/api/v2/activity-room/snapshot'),
  activityRoomExecutions: () => request<readonly ActivityRoomExecutionRecordShape[]>('/api/v2/activity-room/executions'),

  activityRoomPreview: (body: ActivityRoomPreviewRequestShape) =>
    request<ActivityRoomExecutionPlanShape>('/api/v2/activity-room/preview', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  activityRoomRun: (body: ActivityRoomRunRequestShape) =>
    request<ActivityRoomRunResultShape>('/api/v2/activity-room/runs', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  activityHistoryBrowse: (query: ActivityHistoryQueryShape) =>
    request<ActivityHistoryPageShape>(`/api/v2/activity-room/history/browse?${buildHistoryQuery(query)}`),

  activityHistoryEvents: (executionId: string, afterSequence?: number) =>
    request<readonly ActivityHistoryEventShape[]>(
      `/api/v2/activity-room/history/${executionId}/events${afterSequence !== undefined ? `?afterSequence=${afterSequence}` : ''}`,
    ),

  activityHistoryInspector: (executionId: string) =>
    request<ActivityInspectorViewShape>(`/api/v2/activity-room/history/${executionId}/inspector`),

  generate: (body: AiGenerateRequest) => request<{ content: string }>('/api/v2/ai/generate', { method: 'POST', body: JSON.stringify(body) }),

  stream: (body: AiGenerateRequest, onEvent: (event: AiStreamEvent) => void): Promise<void> =>
    fetch('/api/v2/ai/stream', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(async (response) => {
      if (!response.ok || !response.body) throw new Error(`stream failed: ${response.status}`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const raw of events) {
          const line = raw.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          const payload = line.slice(6);
          if (!payload) continue;
          try {
            onEvent(JSON.parse(payload) as AiStreamEvent);
          } catch {
            // ignore malformed
          }
        }
      }
    }),
};

function buildHistoryQuery(query: ActivityHistoryQueryShape): string {
  const params = new URLSearchParams();
  const append = (key: string, value: string | number): void => {
    params.append(key, String(value));
  };
  if (query.goal !== undefined && query.goal.trim()) append('goal', query.goal.trim());
  if (query.status && query.status.length > 0) query.status.forEach((value) => append('status', value));
  if (query.complexity && query.complexity.length > 0) query.complexity.forEach((value) => append('complexity', value));
  if (query.agentId !== undefined) append('agentId', query.agentId);
  if (query.workflowId !== undefined) append('workflowId', query.workflowId);
  if (query.verification && query.verification.length > 0) query.verification.forEach((value) => append('verification', value));
  if (query.from !== undefined) append('from', query.from);
  if (query.to !== undefined) append('to', query.to);
  if (query.sort !== undefined) append('sort', query.sort);
  if (query.cursor !== undefined) append('cursor', query.cursor);
  if (query.limit !== undefined) append('limit', query.limit);
  return params.toString();
}
