import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { AgentRegistry } from '../agent/registry/agent-registry.js';
import type { AgentRunStateMachine } from '../agent/runtime/run-state-machine.js';
import type { ApprovalRuntime } from '../agent/approval/approval-runtime.js';
import type { ExecutionService } from '../execution/index.js';
import type { WorkflowService } from '../workflow/service/workflow-service.js';
import type { ActivityHistoryStore, ActivityHistoryRecorder } from '../activity-room/index.js';
import { recoverExecution } from '../activity-room/index.js';
import type { ActivityBrowser } from '../activity-room/index.js';
import type { ActivityExecutionStatus, ActivityExecutionComplexity } from '../activity-room/index.js';
import type { ActivityVerificationConclusion } from '../activity-room/index.js';
import { readInspectorSource, buildInspectorView, resolveEvidenceDetail, resolveVerificationDetail, resolveFileDiff } from '../activity-room/index.js';
import type { CodingExecutionEvidenceStore } from '../car/evidence/contracts.js';

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

const GovernedActivityRunResultSchema = Type.Object({
  executionId: Type.String(),
  complexity: Type.Union([Type.Literal('simple'), Type.Literal('standard'), Type.Literal('complex')]),
  route: Type.Union([Type.Literal('developer'), Type.Literal('workflow')]),
  status: Type.String(),
  workflowId: Type.Optional(Type.String()),
  workflowRunId: Type.Optional(Type.String()),
});

const ActivityExecutionFactSchema = Type.Object({
  executionId: Type.String(),
  roomId: Type.String(),
  goal: Type.String(),
  agentId: Type.String(),
  complexity: Type.Union([Type.Literal('simple'), Type.Literal('standard'), Type.Literal('complex')]),
  status: Type.String(),
  createdAt: Type.String(),
  startedAt: Type.Optional(Type.String()),
  completedAt: Type.Optional(Type.String()),
  updatedAt: Type.String(),
  workflowId: Type.Optional(Type.String()),
  workflowRunId: Type.Optional(Type.String()),
  runtimeSessionId: Type.Optional(Type.String()),
  verificationFingerprint: Type.Optional(Type.String()),
  evidenceHash: Type.Optional(Type.String()),
});

const ActivityEventEnvelopeSchema = Type.Object({
  id: Type.String(),
  executionId: Type.String(),
  sequence: Type.Integer(),
  occurredAt: Type.String(),
  type: Type.String(),
  payload: Type.Any(),
});

const ActivityExecutionProjectionSchema = Type.Object({
  executionId: Type.String(),
  goal: Type.String(),
  status: Type.String(),
  phase: Type.String(),
  complexity: Type.String(),
  workflowId: Type.Optional(Type.String()),
  workflowRunId: Type.Optional(Type.String()),
  updatedAt: Type.String(),
});

const ActivityExecutionSummarySchema = Type.Object({
  executionId: Type.String(),
  goal: Type.String(),
  complexity: Type.Union([Type.Literal('simple'), Type.Literal('standard'), Type.Literal('complex')]),
  status: Type.String(),
  participants: Type.Array(Type.String()),
  verification: Type.Object({
    conclusion: Type.Union([Type.Literal('pass'), Type.Literal('fail'), Type.Literal('indeterminate'), Type.Literal('pending')]),
    handoffEligible: Type.Boolean(),
  }),
  changedFileCount: Type.Integer(),
  startedAt: Type.String(),
  updatedAt: Type.String(),
});

const ActivityHistoryPageSchema = Type.Object({
  items: Type.Array(ActivityExecutionSummarySchema),
  nextCursor: Type.Optional(Type.String()),
  hasMore: Type.Boolean(),
});

const InspectorViewSchema = Type.Object({
  executionId: Type.String(),
  goal: Type.String(),
  overview: Type.Object({
    executionId: Type.String(),
    goal: Type.String(),
    status: Type.String(),
    phase: Type.String(),
    complexity: Type.String(),
    participants: Type.Array(Type.Object({ role: Type.String(), agentId: Type.String(), status: Type.String() })),
    workflowId: Type.Optional(Type.String()),
    workflowRunId: Type.Optional(Type.String()),
    startedAt: Type.Optional(Type.String()),
    updatedAt: Type.String(),
    completedAt: Type.Optional(Type.String()),
  }),
  runtime: Type.Object({
    runtimeId: Type.Optional(Type.String()),
    provider: Type.Optional(Type.String()),
    model: Type.Optional(Type.String()),
    sessionId: Type.Optional(Type.String()),
    health: Type.Union([Type.Literal('connected'), Type.Literal('unknown'), Type.Literal('unavailable')]),
  }),
  context: Type.Object({
    categories: Type.Array(Type.String()),
    skills: Type.Array(Type.Object({ id: Type.String(), version: Type.Optional(Type.String()) })),
    resourceCount: Type.Integer(),
    provenance: Type.Array(Type.String()),
    budget: Type.Optional(Type.Object({ used: Type.Number(), limit: Type.Optional(Type.Number()) })),
  }),
  changes: Type.Object({
    fileCount: Type.Integer(),
    files: Type.Array(
      Type.Object({
        path: Type.String(),
        status: Type.String(),
        additions: Type.Optional(Type.Number()),
        deletions: Type.Optional(Type.Number()),
      }),
    ),
  }),
  verification: Type.Object({
    status: Type.String(),
    conclusion: Type.Optional(Type.String()),
    freshness: Type.Optional(Type.String()),
    level: Type.Optional(Type.String()),
    selectedTests: Type.Integer(),
    executedTests: Type.Integer(),
    cached: Type.Integer(),
    fingerprint: Type.Optional(Type.String()),
    reasons: Type.Array(Type.String()),
    handoffEligible: Type.Boolean(),
  }),
  evidence: Type.Object({
    status: Type.String(),
    hash: Type.Optional(Type.String()),
    outcome: Type.Optional(Type.String()),
    recordedAt: Type.Optional(Type.String()),
  }),
  timeline: Type.Array(
    Type.Object({
      sequence: Type.Integer(),
      type: Type.String(),
      title: Type.String(),
      detail: Type.Optional(Type.String()),
      at: Type.String(),
    }),
  ),
});

const InspectorEvidenceDetailSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  outcome: Type.String(),
  execution: Type.Object({
    executionId: Type.String(),
    agentRunId: Type.String(),
    objective: Type.Optional(Type.String()),
  }),
  agent: Type.Object({ id: Type.String(), role: Type.String() }),
  runtime: Type.Object({
    id: Type.String(),
    version: Type.Optional(Type.String()),
    sessionId: Type.Optional(Type.String()),
  }),
  model: Type.Optional(
    Type.Object({ providerId: Type.Optional(Type.String()), modelId: Type.Optional(Type.String()) }),
  ),
  repository: Type.Object({
    baselineSha: Type.Optional(Type.String()),
    headSha: Type.Optional(Type.String()),
    changedFiles: Type.Optional(Type.Array(Type.String())),
  }),
  skills: Type.Array(Type.Object({ id: Type.String(), version: Type.Optional(Type.String()) })),
  tools: Type.Array(Type.Object({ id: Type.String(), granted: Type.Boolean(), used: Type.Boolean() })),
  verification: Type.Object({
    purpose: Type.String(),
    conclusion: Type.Union([Type.Literal('pass'), Type.Literal('fail'), Type.Literal('indeterminate')]),
    freshness: Type.Union([Type.Literal('current'), Type.Literal('stale')]),
    fingerprint: Type.Optional(Type.String()),
  }),
  timing: Type.Object({ startedAt: Type.String(), completedAt: Type.String() }),
  evidenceHash: Type.String(),
});

const InspectorVerificationDetailSchema = Type.Object({
  fingerprint: Type.String(),
  level: Type.String(),
  scope: Type.String(),
  result: Type.Union([Type.Literal('pass'), Type.Literal('fail'), Type.Literal('indeterminate')]),
  selectedTests: Type.Array(Type.String()),
  executedTests: Type.Array(Type.String()),
  cached: Type.Integer(),
  failed: Type.Integer(),
  durationMs: Type.Number(),
  graphValid: Type.Boolean(),
  evidence: Type.Union([Type.String(), Type.Null()]),
});

const InspectorFileDiffSchema = Type.Object({
  path: Type.String(),
  status: Type.String(),
  additions: Type.Integer(),
  deletions: Type.Integer(),
  hunks: Type.Array(
    Type.Object({
      header: Type.String(),
      lines: Type.Array(Type.Object({ type: Type.Union([Type.Literal('add'), Type.Literal('delete'), Type.Literal('context')]), text: Type.String() })),
    }),
  ),
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
  const history = app.application.container.resolve<ActivityHistoryStore>('activity.history');
  const recorder = app.application.container.resolve<ActivityHistoryRecorder>('activity.recorder');
  const browser = app.application.container.resolve<ActivityBrowser>('activity.browser');
  const evidence = app.application.container.resolve<CodingExecutionEvidenceStore>('activity.evidence');

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

  app.get(
    '/api/v2/activity-room/history',
    {
      schema: {
        tags: ['activity-room'],
        summary: 'List durable Activity history facts',
        response: { 200: Type.Array(ActivityExecutionFactSchema) },
      },
    },
    async (_request, reply) => reply.send(history.listExecutions('activity-room') as never),
  );

  app.get(
    '/api/v2/activity-room/history/:executionId',
    {
      schema: {
        tags: ['activity-room'],
        summary: 'Recover an execution projection from durable Activity history',
        params: Type.Object({ executionId: Type.String() }),
        response: {
          200: ActivityExecutionProjectionSchema,
          404: Type.Object({ error: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const recovered = recoverExecution(history, request.params.executionId);
      if (!recovered) {
        return reply.code(404).send({ error: 'execution not found in activity history' } as never);
      }
      return reply.send(recovered.projection as never);
    },
  );

  app.get(
    '/api/v2/activity-room/history/:executionId/events',
    {
      schema: {
        tags: ['activity-room'],
        summary: 'Read monotonic Activity events, optionally after a cursor',
        params: Type.Object({ executionId: Type.String() }),
        // HTTP query parameters arrive as strings. The transport schema
        // matches the wire representation; parseAfterSequence normalizes at
        // the boundary so the history/store contract stays numeric.
        querystring: Type.Object({
          afterSequence: Type.Optional(Type.String({ pattern: '^\\d+$' })),
        }),
        additionalProperties: false,
        response: { 200: Type.Array(ActivityEventEnvelopeSchema) },
      },
    },
    async (request, reply) => {
      const afterSequence = parseAfterSequence(request.query.afterSequence);
      const events = history.events(request.params.executionId, afterSequence);
      return reply.send(events as never);
    },
  );

  app.get(
    '/api/v2/activity-room/history/browse',
    {
      schema: {
        tags: ['activity-room'],
        summary: 'Browse durable Activity history as bounded, cursor-paginated summaries',
        querystring: Type.Object({
          goal: Type.Optional(Type.String()),
          status: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])),
          complexity: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])),
          agentId: Type.Optional(Type.String()),
          workflowId: Type.Optional(Type.String()),
          verification: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])),
          from: Type.Optional(Type.String()),
          to: Type.Optional(Type.String()),
          sort: Type.Optional(Type.Union([Type.Literal('newest'), Type.Literal('oldest')])),
          cursor: Type.Optional(Type.String()),
          limit: Type.Optional(Type.String()),
        }),
        response: { 200: ActivityHistoryPageSchema },
      },
    },
    async (request, reply) => {
      const page = browser.browse({
        roomId: 'activity-room',
        ...(request.query.goal !== undefined ? { goal: request.query.goal } : {}),
        ...(request.query.status !== undefined ? { status: toArray(request.query.status) as ActivityExecutionStatus[] } : {}),
        ...(request.query.complexity !== undefined ? { complexity: toArray(request.query.complexity) as ActivityExecutionComplexity[] } : {}),
        ...(request.query.agentId !== undefined ? { agentId: request.query.agentId } : {}),
        ...(request.query.workflowId !== undefined ? { workflowId: request.query.workflowId } : {}),
        ...(request.query.verification !== undefined ? { verification: toArray(request.query.verification) as ActivityVerificationConclusion[] } : {}),
        ...(request.query.from !== undefined ? { from: request.query.from } : {}),
        ...(request.query.to !== undefined ? { to: request.query.to } : {}),
        ...(request.query.sort !== undefined ? { sort: request.query.sort } : {}),
        ...(request.query.cursor !== undefined ? { cursor: request.query.cursor } : {}),
        ...(request.query.limit !== undefined ? { limit: Number(request.query.limit) } : {}),
      });
      return reply.send(page as never);
    },
  );

  app.get(
    '/api/v2/activity-room/history/:executionId/inspector',
    {
      schema: {
        tags: ['activity-room'],
        summary: 'Read the moderate Execution Inspector v2 view for an execution',
        params: Type.Object({ executionId: Type.String() }),
        response: {
          200: InspectorViewSchema,
          404: Type.Object({ error: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const source = readInspectorSource(history, request.params.executionId);
      if (!source) {
        return reply.code(404).send({ error: 'execution not found in activity history' } as never);
      }
      return reply.send(buildInspectorView(source) as never);
    },
  );

  app.get(
    '/api/v2/activity-room/history/:executionId/inspector/evidence',
    {
      schema: {
        tags: ['activity-room'],
        summary: 'Resolve the immutable CP5 evidence detail for an execution (lazy)',
        params: Type.Object({ executionId: Type.String() }),
        response: {
          200: InspectorEvidenceDetailSchema,
          404: Type.Object({ error: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const source = readInspectorSource(history, request.params.executionId);
      if (!source) {
        return reply.code(404).send({ error: 'execution not found in activity history' } as never);
      }
      const hash = source.fact.evidenceHash;
      if (hash === undefined) {
        return reply.code(404).send({ error: 'no evidence recorded for this execution' } as never);
      }
      const detail = await resolveEvidenceDetail(evidence, hash);
      if (!detail) {
        return reply.code(404).send({ error: 'evidence detail not resolvable' } as never);
      }
      return reply.send(detail as never);
    },
  );

  app.get(
    '/api/v2/activity-room/history/:executionId/inspector/verification',
    {
      schema: {
        tags: ['activity-room'],
        summary: 'Resolve the verification report by fingerprint (lazy)',
        params: Type.Object({ executionId: Type.String() }),
        response: {
          200: InspectorVerificationDetailSchema,
          404: Type.Object({ error: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const source = readInspectorSource(history, request.params.executionId);
      if (!source) {
        return reply.code(404).send({ error: 'execution not found in activity history' } as never);
      }
      const fingerprint = source.fact.verificationFingerprint;
      if (fingerprint === undefined) {
        return reply.code(404).send({ error: 'no verification fingerprint for this execution' } as never);
      }
      const detail = resolveVerificationDetail(fingerprint);
      if (!detail) {
        return reply.code(404).send({ error: 'verification report not resolvable' } as never);
      }
      return reply.send(detail as never);
    },
  );

  app.get(
    '/api/v2/activity-room/history/:executionId/inspector/files/:path/diff',
    {
      schema: {
        tags: ['activity-room'],
        summary: 'Resolve a file-level diff for a changed file (lazy)',
        params: Type.Object({ executionId: Type.String(), path: Type.String() }),
        response: {
          200: InspectorFileDiffSchema,
          404: Type.Object({ error: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const source = readInspectorSource(history, request.params.executionId);
      if (!source) {
        return reply.code(404).send({ error: 'execution not found in activity history' } as never);
      }
      const diff = resolveFileDiff(source, request.params.path);
      if (!diff) {
        return reply.code(404).send({ error: 'file is not part of this execution change set' } as never);
      }
      return reply.send(diff as never);
    },
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

      const draft = execution.get(preview.executionId);
      if (draft) {
        recorder.recordExecution({ execution: draft });
      }

      return reply.send(preview as never);
    },
  );

  app.post(
    '/api/v2/activity-room/runs',
    {
      schema: {
        tags: ['activity-room'],
        summary: 'Start a governed Activity Room execution (complexity-routed through DEX/CAR)',
        body: ExecutionPreviewBodySchema,
        response: { 201: GovernedActivityRunResultSchema },
      },
    },
    async (request, reply) => {
      const runner = app.application.container.resolve<import('../activity-room/runtime/governed-runner.js').GovernedActivityRunner>('activity.runner');
      const result = await runner.start({
        goal: request.body.goal,
        ...(request.body.principalId !== undefined ? { principalId: request.body.principalId } : {}),
      });
      return reply.code(201).send(result as never);
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

      // Execution-scoped verification: resolve the report by the latest
      // Activity execution's fingerprint instead of the global /verification/latest
      // (diagnostics-only). The authoritative association lives on the fact.
      const executionFacts = history.listExecutions('activity-room');
      const latestVerifiedFact = [...executionFacts]
        .sort((left, right) =>
          (right.updatedAt ?? right.createdAt ?? '').localeCompare(left.updatedAt ?? left.createdAt ?? ''),
        )
        .find((fact) => fact.verificationFingerprint !== undefined);
      const verification =
        latestVerifiedFact?.verificationFingerprint !== undefined
          ? resolveVerificationDetail(latestVerifiedFact.verificationFingerprint)
          : null;

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

function toArray(value: string | string[]): string[] {
  return Array.isArray(value) ? [...value] : [value];
}

/**
 * ARX-STAB-002 — Normalize the `afterSequence` event cursor at the HTTP
 * boundary. Query parameters arrive as strings; the history/store contract
 * stays numeric. The Fastify schema already constrains the wire form to a
 * `\d+` pattern, so this parse is the final safety net before the domain.
 */
function parseAfterSequence(value: string | undefined): number {
  if (value === undefined || value === '') {
    return 0;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('afterSequence must be a non-negative integer');
  }

  return parsed;
}

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
