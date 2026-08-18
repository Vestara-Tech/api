import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { AgentRegistry } from '../agent/registry/agent-registry.js';
import type { AgentRunStateMachine } from '../agent/runtime/run-state-machine.js';
import type { ApprovalRuntime } from '../agent/approval/approval-runtime.js';
import type { ExecutionService } from '../execution/index.js';
import type { WorkflowService } from '../workflow/service/workflow-service.js';
import { readLatestVerificationReport } from '../verification/index.js';

const ExecutionIntentSchema = Type.Object({
  kind: Type.Union([
    Type.Literal('generate'),
    Type.Literal('build'),
    Type.Literal('modify'),
    Type.Literal('fix'),
    Type.Literal('test'),
    Type.Literal('verify'),
    Type.Literal('inspect'),
    Type.Literal('configure'),
  ]),
  target: Type.String(),
  confidence: Type.Number(),
  complexity: Type.Union([Type.Literal('simple'), Type.Literal('standard'), Type.Literal('complex')]),
  ambiguities: Type.Array(Type.Object({ code: Type.String(), message: Type.String() })),
  requiredCapabilities: Type.Array(Type.String()),
});

const ExecutionRequestSchema = Type.Object({
  id: Type.String(),
  goal: Type.String(),
  agentId: Type.String(),
  agentName: Type.Optional(Type.String()),
  roomId: Type.String(),
  principalId: Type.Optional(Type.String()),
  requestedAt: Type.String(),
});

const ExecutionCapabilitySchema = Type.Object({
  namespace: Type.String(),
  version: Type.String(),
  permissions: Type.Array(Type.String()),
  operations: Type.Array(Type.String()),
});

const ExecutionStepSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  role: Type.Union([Type.Literal('planner'), Type.Literal('developer'), Type.Literal('reviewer'), Type.Literal('verifier'), Type.Literal('observer')]),
  capability: Type.String(),
  operation: Type.String(),
  requiresApproval: Type.Boolean(),
  evidence: Type.Array(Type.String()),
});

const ExecutionMilestoneSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  steps: Type.Array(ExecutionStepSchema),
});

const ExecutionPlanSchema = Type.Object({
  id: Type.String(),
  executionId: Type.String(),
  status: Type.String(),
  request: ExecutionRequestSchema,
  intent: ExecutionIntentSchema,
  capabilities: Type.Array(ExecutionCapabilitySchema),
  milestones: Type.Array(ExecutionMilestoneSchema),
  evidence: Type.Array(Type.String()),
  warnings: Type.Array(Type.String()),
  summary: Type.String(),
  generatedAt: Type.String(),
});

const ExecutionLeaseSchema = Type.Object({
  id: Type.String(),
  executionId: Type.String(),
  holder: Type.String(),
  issuedAt: Type.String(),
  expiresAt: Type.String(),
});

const ExecutionRecordSchema = Type.Object({
  id: Type.String(),
  status: Type.String(),
  request: ExecutionRequestSchema,
  plan: ExecutionPlanSchema,
  eventCount: Type.Integer(),
  lease: Type.Optional(ExecutionLeaseSchema),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  startedAt: Type.Optional(Type.String()),
  completedAt: Type.Optional(Type.String()),
  result: Type.Optional(Type.Union([Type.Literal('pass'), Type.Literal('fail'), Type.Literal('indeterminate')])),
  evidence: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

const ExecutionPreviewBodySchema = Type.Object({
  goal: Type.String(),
  agentId: Type.Optional(Type.String()),
  principalId: Type.Optional(Type.String()),
});

const AgentRunSummarySchema = Type.Object({
  id: Type.String(),
  agentId: Type.String(),
  status: Type.String(),
  startedAt: Type.Optional(Type.String()),
  completedAt: Type.Optional(Type.String()),
  result: Type.Optional(Type.String()),
  error: Type.Optional(Type.String()),
});

const WorkflowRunSummarySchema = Type.Object({
  id: Type.String(),
  workflowId: Type.String(),
  status: Type.String(),
  startedAt: Type.Optional(Type.String()),
  completedAt: Type.Optional(Type.String()),
  waitingOnStep: Type.Optional(Type.String()),
  error: Type.Optional(Type.String()),
});

const ApprovalSummarySchema = Type.Object({
  id: Type.String(),
  runId: Type.String(),
  agentId: Type.String(),
  toolId: Type.String(),
  subject: Type.String(),
  risk: Type.String(),
  status: Type.String(),
  requestedAt: Type.String(),
  decidedAt: Type.Optional(Type.String()),
  decidedBy: Type.Optional(Type.String()),
});

const VerificationSummarySchema = Type.Union([
  Type.Null(),
  Type.Object({
    level: Type.String(),
    result: Type.Union([Type.Literal('pass'), Type.Literal('fail'), Type.Literal('indeterminate')]),
    scope: Type.String(),
    graphValid: Type.Boolean(),
    selectedTests: Type.Number(),
    executedTests: Type.Number(),
    cached: Type.Number(),
    durationMs: Type.Number(),
    evidence: Type.Union([Type.String(), Type.Null()]),
    fingerprint: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  }),
]);

const ActivityTimelineItemSchema = Type.Object({
  id: Type.String(),
  kind: Type.Union([Type.Literal('agent-run'), Type.Literal('workflow-run'), Type.Literal('approval'), Type.Literal('verification'), Type.Literal('execution')]),
  title: Type.String(),
  detail: Type.String(),
  status: Type.String(),
  at: Type.String(),
});

const ActivityRoomSnapshotSchema = Type.Object({
  generatedAt: Type.String(),
  counts: Type.Object({
    agents: Type.Integer(),
    agentRuns: Type.Integer(),
    activeAgentRuns: Type.Integer(),
    approvals: Type.Integer(),
    pendingApprovals: Type.Integer(),
    workflows: Type.Integer(),
    workflowRuns: Type.Integer(),
    activeWorkflowRuns: Type.Integer(),
  }),
  agents: Type.Array(
    Type.Object({
      id: Type.String(),
      name: Type.String(),
      role: Type.String(),
      toolCount: Type.Integer(),
      skillCount: Type.Integer(),
      permissions: Type.Array(Type.String()),
      latestRunId: Type.Union([Type.String(), Type.Null()]),
      latestRunStatus: Type.Union([Type.String(), Type.Null()]),
      latestRunAt: Type.Union([Type.String(), Type.Null()]),
    }),
  ),
  agentRuns: Type.Array(AgentRunSummarySchema),
  approvals: Type.Array(ApprovalSummarySchema),
  workflowDefinitions: Type.Array(
    Type.Object({
      id: Type.String(),
      name: Type.String(),
      version: Type.String(),
      status: Type.String(),
      revision: Type.Integer(),
    }),
  ),
  workflowRuns: Type.Array(WorkflowRunSummarySchema),
  verification: VerificationSummarySchema,
  timeline: Type.Array(ActivityTimelineItemSchema),
});

/**
 * ARX — Activity Room projection API.
 *
 * Composes the current agent, workflow, approval and verification state into
 * one narrative snapshot for the Activity Room UI.
 */
export const activityRoomRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const agents = app.application.container.resolve<AgentRegistry>('agent.registry');
  const runs = app.application.container.resolve<AgentRunStateMachine>('agent.runs');
  const approvals = app.application.container.resolve<ApprovalRuntime>('agent.approvals');
  const execution = app.application.container.resolve<ExecutionService>('execution.service');
  const workflow = app.application.workflow.service;

  app.get(
    '/api/v2/activity-room/executions',
    {
      schema: {
        tags: ['activity-room'],
        summary: 'List durable Activity Room execution drafts',
        response: { 200: Type.Array(ExecutionRecordSchema) },
      },
    },
    async (_request, reply) => reply.send(execution.list('activity-room').map(toExecutionView) as never),
  );

  app.post(
    '/api/v2/activity-room/preview',
    {
      schema: {
        tags: ['activity-room'],
        summary: 'Preview a governed Activity Room execution plan',
        body: ExecutionPreviewBodySchema,
        response: { 200: ExecutionPlanSchema },
      },
    },
    async (request, reply) => {
      const preview = execution.preview({
        goal: request.body.goal,
        agentId: request.body.agentId ?? 'vestara-developer',
        roomId: 'activity-room',
        ...(request.body.principalId !== undefined ? { principalId: request.body.principalId } : {}),
      });
      return reply.send(preview as never);
    },
  );

  app.get(
    '/api/v2/activity-room/snapshot',
    {
      schema: {
        tags: ['activity-room'],
        summary: 'Read the current Activity Room execution snapshot',
        response: { 200: ActivityRoomSnapshotSchema },
      },
    },
    async (_request, reply) => {
      const generatedAt = new Date().toISOString();
      const agentDefinitions = agents.list();
      const agentRuns = runs.list();
      const approvalList = approvals.list();
      const executionDrafts = execution.list('activity-room');
      const workflowDefinitions = workflow.list();
      const workflowRuns = workflow.listRuns();
      const verification = readLatestVerificationReport();

      const latestRunByAgent = new Map<string, (typeof agentRuns)[number]>();
      for (const run of [...agentRuns].sort((left, right) => {
        const leftAt = left.startedAt ?? left.completedAt ?? '';
        const rightAt = right.startedAt ?? right.completedAt ?? '';
        return rightAt.localeCompare(leftAt) || right.id.localeCompare(left.id);
      })) {
        if (!latestRunByAgent.has(run.agentId)) latestRunByAgent.set(run.agentId, run);
      }

      const agentsView = agentDefinitions.map((agent) => {
        const latestRun = latestRunByAgent.get(agent.id) ?? null;
        return {
          id: agent.id,
          name: agent.name,
          role: agent.role,
          toolCount: agent.tools.length,
          skillCount: agent.skills.length,
          permissions: [...agent.permissions],
          latestRunId: latestRun?.id ?? null,
          latestRunStatus: latestRun?.status ?? null,
          latestRunAt: latestRun?.startedAt ?? latestRun?.completedAt ?? null,
        };
      });

      const activeAgentRuns = agentRuns.filter((run) => !['completed', 'failed', 'cancelled'].includes(run.status)).length;
      const pendingApprovals = approvalList.filter((approval) => approval.status === 'pending').length;
      const activeWorkflowRuns = workflowRuns.filter((run) => !['completed', 'failed', 'cancelled'].includes(run.status)).length;

      const verificationSummary =
        verification === null
          ? null
          : {
              level: verification.level,
              result: verification.result,
              scope: verification.scope,
              graphValid: verification.graphValid,
              selectedTests: verification.selectedTests.length,
              executedTests: verification.executedTests.length,
              cached: verification.cached,
              durationMs: verification.durationMs,
              evidence: verification.evidence,
              ...(verification.fingerprint !== undefined ? { fingerprint: verification.fingerprint } : {}),
            };

      const timeline = [
        ...agentRuns.map((run) => ({
          id: `agent-run:${run.id}`,
          kind: 'agent-run' as const,
          title: `Agent run ${run.agentId}`,
          detail: run.result ?? run.error ?? run.status,
          status: run.status,
          at: run.startedAt ?? run.completedAt ?? generatedAt,
        })),
        ...workflowRuns.map((run) => ({
          id: `workflow-run:${run.id}`,
          kind: 'workflow-run' as const,
          title: `Workflow ${run.workflowId}`,
          detail: run.waitingOnStep ?? run.error ?? run.status,
          status: run.status,
          at: run.startedAt ?? run.completedAt ?? generatedAt,
        })),
        ...approvalList.map((approval) => ({
          id: `approval:${approval.id}`,
          kind: 'approval' as const,
          title: `Approval ${approval.toolId}`,
          detail: approval.subject,
          status: approval.status,
          at: approval.requestedAt,
        })),
        ...executionDrafts.flatMap((draft) =>
          draft.events.map((event) => ({
            id: `execution:${draft.id}:${event.id}`,
            kind: 'execution' as const,
            title: `Execution ${draft.request.goal}`,
            detail: event.detail ?? event.type,
            status: event.type,
            at: event.at,
          })),
        ),
        ...(verificationSummary !== null
          ? [
              {
                id: `verification:${generatedAt}`,
                kind: 'verification' as const,
                title: 'Verification',
                detail: `${verificationSummary.result.toUpperCase()} · ${verificationSummary.level}`,
                status: verificationSummary.result,
                at: generatedAt,
              },
            ]
          : []),
      ]
        .sort((left, right) => right.at.localeCompare(left.at) || left.id.localeCompare(right.id))
        .slice(0, 12);

      return reply.send({
        generatedAt,
        counts: {
          agents: agentDefinitions.length,
          agentRuns: agentRuns.length,
          activeAgentRuns,
          approvals: approvalList.length,
          pendingApprovals,
          workflows: workflowDefinitions.length,
          workflowRuns: workflowRuns.length,
          activeWorkflowRuns,
        },
        agents: agentsView,
        agentRuns: [...agentRuns]
          .sort((left, right) => (right.startedAt ?? right.completedAt ?? '').localeCompare(left.startedAt ?? left.completedAt ?? '') || right.id.localeCompare(left.id))
          .slice(0, 8)
          .map((run) => ({
            id: run.id,
            agentId: run.agentId,
            status: run.status,
            startedAt: run.startedAt,
            completedAt: run.completedAt,
            ...(run.result !== undefined ? { result: run.result } : {}),
            ...(run.error !== undefined ? { error: run.error } : {}),
          })),
        approvals: approvalList
          .slice()
          .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt) || right.id.localeCompare(left.id))
          .slice(0, 8)
          .map((approval) => ({
            id: approval.id,
            runId: approval.runId,
            agentId: approval.agentId,
            toolId: approval.toolId,
            subject: approval.subject,
            risk: approval.risk,
            status: approval.status,
            requestedAt: approval.requestedAt,
            ...(approval.decidedAt !== undefined ? { decidedAt: approval.decidedAt } : {}),
            ...(approval.decidedBy !== undefined ? { decidedBy: approval.decidedBy } : {}),
          })),
        workflowDefinitions: workflowDefinitions
          .slice()
          .sort((left, right) => left.id.localeCompare(right.id))
          .map((definition) => ({
            id: definition.id,
            name: definition.name,
            version: definition.version,
            status: definition.status,
            revision: definition.revision,
          })),
        workflowRuns: [...workflowRuns]
          .sort((left, right) => (right.startedAt ?? right.completedAt ?? '').localeCompare(left.startedAt ?? left.completedAt ?? '') || right.id.localeCompare(left.id))
          .slice(0, 8)
          .map((run) => ({
            id: run.id,
            workflowId: run.workflowId,
            status: run.status,
            ...(run.startedAt !== undefined ? { startedAt: run.startedAt } : {}),
            ...(run.completedAt !== undefined ? { completedAt: run.completedAt } : {}),
            ...(run.waitingOnStep !== undefined ? { waitingOnStep: run.waitingOnStep } : {}),
            ...(run.error !== undefined ? { error: run.error } : {}),
          })),
        verification: verificationSummary,
        timeline,
      } as never);
    },
  );
};

function toExecutionView(execution: {
  readonly id: string;
  readonly status: string;
  readonly request: {
    readonly id: string;
    readonly goal: string;
    readonly agentId: string;
    readonly roomId: string;
    readonly requestedAt: string;
    readonly agentName?: string;
    readonly principalId?: string;
  };
  readonly plan: {
    readonly id: string;
    readonly executionId: string;
    readonly status: string;
    readonly request: {
      readonly id: string;
      readonly goal: string;
      readonly agentId: string;
      readonly roomId: string;
      readonly requestedAt: string;
      readonly agentName?: string;
      readonly principalId?: string;
    };
    readonly intent: {
      readonly kind: string;
      readonly target: string;
      readonly confidence: number;
      readonly complexity: string;
      readonly ambiguities: readonly { code: string; message: string }[];
      readonly requiredCapabilities: readonly string[];
    };
    readonly capabilities: readonly { namespace: string; version: string; permissions: readonly string[]; operations: readonly string[] }[];
    readonly milestones: readonly {
      readonly id: string;
      readonly title: string;
      readonly steps: readonly { id: string; title: string; role: string; capability: string; operation: string; requiresApproval: boolean; evidence: readonly string[] }[];
    }[];
    readonly evidence: readonly string[];
    readonly warnings: readonly string[];
    readonly summary: string;
    readonly generatedAt: string;
  };
  readonly events: readonly { id: string }[];
  readonly lease?: { id: string; executionId: string; holder: string; issuedAt: string; expiresAt: string };
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly result?: 'pass' | 'fail' | 'indeterminate';
  readonly evidence?: string | null;
}) {
  return {
    id: execution.id,
    status: execution.status,
    request: execution.request,
    plan: execution.plan,
    eventCount: execution.events.length,
    ...(execution.lease !== undefined ? { lease: execution.lease } : {}),
    createdAt: execution.createdAt,
    updatedAt: execution.updatedAt,
    ...(execution.startedAt !== undefined ? { startedAt: execution.startedAt } : {}),
    ...(execution.completedAt !== undefined ? { completedAt: execution.completedAt } : {}),
    ...(execution.result !== undefined ? { result: execution.result } : {}),
    ...(execution.evidence !== undefined ? { evidence: execution.evidence } : {}),
  };
}
