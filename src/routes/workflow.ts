import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { WorkflowService } from '../workflow/service/workflow-service.js';

const WorkflowViewSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  version: Type.String(),
  description: Type.Optional(Type.String()),
  inputs: Type.Array(Type.Object({ name: Type.String(), type: Type.String(), required: Type.Boolean() })),
  steps: Type.Array(Type.Object({ id: Type.String(), kind: Type.String(), name: Type.String(), dependsOn: Type.Optional(Type.Array(Type.String())) })),
  status: Type.String(),
  revision: Type.Integer(),
});

const RunViewSchema = Type.Object({
  id: Type.String(),
  workflowId: Type.String(),
  version: Type.String(),
  status: Type.String(),
  steps: Type.Array(
    Type.Object({
      stepId: Type.String(),
      name: Type.String(),
      kind: Type.String(),
      status: Type.String(),
      attempts: Type.Integer(),
      error: Type.Optional(Type.String()),
    }),
  ),
  startedAt: Type.Optional(Type.String()),
  completedAt: Type.Optional(Type.String()),
  error: Type.Optional(Type.String()),
  waitingOnStep: Type.Optional(Type.String()),
});

const RunEventSchema = Type.Object({
  runId: Type.String(),
  type: Type.String(),
  at: Type.String(),
  data: Type.Optional(Type.Any()),
});

const StartRunBodySchema = Type.Object({
  inputs: Type.Optional(Type.Record(Type.String(), Type.Any())),
});

const WorkflowInputSchema = Type.Object({
  name: Type.String(),
  type: Type.Union([Type.Literal('string'), Type.Literal('number'), Type.Literal('boolean'), Type.Literal('json')]),
  required: Type.Boolean(),
  default: Type.Optional(Type.Any()),
});

const StepSchema = Type.Object({
  id: Type.String(),
  kind: Type.String(),
  name: Type.String(),
  description: Type.Optional(Type.String()),
  dependsOn: Type.Optional(Type.Array(Type.String())),
  agent: Type.Optional(Type.Object({ agentId: Type.String(), objective: Type.String() })),
  tool: Type.Optional(Type.Object({ toolId: Type.String() })),
  service: Type.Optional(Type.Object({ service: Type.String(), operation: Type.String() })),
  approval: Type.Optional(Type.Object({ approver: Type.String(), subject: Type.String() })),
  verification: Type.Optional(Type.Object({ requirements: Type.Array(Type.String()), requireEvidence: Type.Boolean() })),
  delay: Type.Optional(Type.Object({ seconds: Type.Integer() })),
});

const CreateWorkflowBodySchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  version: Type.String(),
  description: Type.Optional(Type.String()),
  inputs: Type.Optional(Type.Array(WorkflowInputSchema)),
  triggers: Type.Optional(Type.Array(Type.Object({ kind: Type.String() }))),
  steps: Type.Array(StepSchema),
});

const ApiErrorSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    requestId: Type.String(),
    correlationId: Type.String(),
    retryable: Type.Boolean(),
    details: Type.Optional(Type.Any()),
  }),
});

/**
 * WF-015 — Workflow control API. Definitions (create/get/list/publish),
 * validation, and durable runs (start/get/list/cancel/resume/retry + events).
 */
export const workflowRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const workflow = app.application.workflow.service;

  app.get(
    '/api/v2/workflows',
    {
      schema: {
        tags: ['workflows'],
        summary: 'List workflow definitions',
        response: { 200: Type.Array(WorkflowViewSchema) },
      },
    },
    async (_request, reply) => reply.send(toWorkflowViews(workflow) as never),
  );

  app.post(
    '/api/v2/workflows',
    {
      schema: {
        tags: ['workflows'],
        summary: 'Create a workflow definition',
        body: CreateWorkflowBodySchema,
        response: { 201: WorkflowViewSchema, 400: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      const def = workflow.create(request.body as never);
      return reply.status(201).send(toWorkflowView(def) as never);
    },
  );

  app.get(
    '/api/v2/workflows/:id',
    {
      schema: {
        tags: ['workflows'],
        summary: 'Get a workflow definition',
        params: Type.Object({ id: Type.String() }),
        response: { 200: WorkflowViewSchema, 404: ApiErrorSchema },
      },
    },
    async (request, reply) => reply.send(toWorkflowView(workflow.get(request.params.id)) as never),
  );

  app.post(
    '/api/v2/workflows/:id/publish',
    {
      schema: {
        tags: ['workflows'],
        summary: 'Publish a workflow definition',
        params: Type.Object({ id: Type.String() }),
        response: { 200: WorkflowViewSchema, 404: ApiErrorSchema },
      },
    },
    async (request, reply) => reply.send(toWorkflowView(workflow.publish(request.params.id)) as never),
  );

  app.post(
    '/api/v2/workflows/:id/runs',
    {
      schema: {
        tags: ['workflows'],
        summary: 'Start a workflow run',
        params: Type.Object({ id: Type.String() }),
        body: StartRunBodySchema,
        response: { 201: RunViewSchema, 404: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      const run = workflow.start(request.params.id, request.body.inputs ?? {});
      return reply.status(201).send(toRunView(run) as never);
    },
  );

  app.get(
    '/api/v2/workflow-runs',
    {
      schema: {
        tags: ['workflows'],
        summary: 'List workflow runs',
        querystring: Type.Object({ workflowId: Type.Optional(Type.String()) }),
        response: { 200: Type.Array(RunViewSchema) },
      },
    },
    async (request, reply) => reply.send(workflow.listRuns(request.query.workflowId).map(toRunView) as never),
  );

  app.get(
    '/api/v2/workflow-runs/:id',
    {
      schema: {
        tags: ['workflows'],
        summary: 'Get a workflow run',
        params: Type.Object({ id: Type.String() }),
        response: { 200: RunViewSchema, 404: ApiErrorSchema },
      },
    },
    async (request, reply) => reply.send(toRunView(workflow.getRun(request.params.id)) as never),
  );

  app.get(
    '/api/v2/workflow-runs/:id/events',
    {
      schema: {
        tags: ['workflows'],
        summary: 'Get workflow run events',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Array(RunEventSchema) },
      },
    },
    async (request, reply) => {
      const { WorkflowRuntime } = await import('../workflow/runtime/workflow-runtime.js');
      const runtime = app.application.container.resolve<InstanceType<typeof WorkflowRuntime>>('workflow.runtime');
      return reply.send(runtime.eventsFor(request.params.id) as never);
    },
  );

  app.post(
    '/api/v2/workflow-runs/:id/cancel',
    {
      schema: {
        tags: ['workflows'],
        summary: 'Cancel a workflow run',
        params: Type.Object({ id: Type.String() }),
        response: { 200: RunViewSchema, 404: ApiErrorSchema },
      },
    },
    async (request, reply) => reply.send(toRunView(workflow.cancel(request.params.id)) as never),
  );

  app.post(
    '/api/v2/workflow-runs/:id/resume',
    {
      schema: {
        tags: ['workflows'],
        summary: 'Resume a suspended workflow run',
        params: Type.Object({ id: Type.String() }),
        response: { 200: RunViewSchema, 404: ApiErrorSchema },
      },
    },
    async (request, reply) => reply.send(toRunView(workflow.resume(request.params.id)) as never),
  );

  app.post(
    '/api/v2/workflow-runs/:id/retry',
    {
      schema: {
        tags: ['workflows'],
        summary: 'Retry a failed workflow run',
        params: Type.Object({ id: Type.String() }),
        response: { 200: RunViewSchema, 404: ApiErrorSchema },
      },
    },
    async (request, reply) => reply.send(toRunView(workflow.retry(request.params.id)) as never),
  );
};

function toWorkflowViews(workflow: WorkflowService) {
  return workflow.list().map(toWorkflowView);
}

function toWorkflowView(def: { id: string; name: string; version: string; description?: string; inputs: readonly { name: string; type: string; required: boolean }[]; steps: readonly { id: string; kind: string; name: string; dependsOn?: readonly string[] }[]; status: string; revision: number }) {
  return {
    id: def.id,
    name: def.name,
    version: def.version,
    ...(def.description !== undefined ? { description: def.description } : {}),
    inputs: def.inputs.map((i) => ({ name: i.name, type: i.type, required: i.required })),
    steps: def.steps.map((s) => ({
      id: s.id,
      kind: s.kind,
      name: s.name,
      ...(s.dependsOn !== undefined ? { dependsOn: s.dependsOn } : {}),
    })),
    status: def.status,
    revision: def.revision,
  };
}

function toRunView(run: { id: string; workflowId: string; version: string; status: string; steps: readonly { stepId: string; name: string; kind: string; status: string; attempts: number; error?: string }[]; startedAt?: string; completedAt?: string; error?: string; waitingOnStep?: string }) {
  return {
    id: run.id,
    workflowId: run.workflowId,
    version: run.version,
    status: run.status,
    steps: run.steps.map((s) => ({
      stepId: s.stepId,
      name: s.name,
      kind: s.kind,
      status: s.status,
      attempts: s.attempts,
      ...(s.error !== undefined ? { error: s.error } : {}),
    })),
    ...(run.startedAt !== undefined ? { startedAt: run.startedAt } : {}),
    ...(run.completedAt !== undefined ? { completedAt: run.completedAt } : {}),
    ...(run.error !== undefined ? { error: run.error } : {}),
    ...(run.waitingOnStep !== undefined ? { waitingOnStep: run.waitingOnStep } : {}),
  };
}
