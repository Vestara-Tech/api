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
