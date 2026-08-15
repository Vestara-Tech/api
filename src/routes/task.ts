import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { TaskService } from '../task/service/task-service.js';

const TaskViewSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  type: Type.String(),
  status: Type.String(),
  priority: Type.String(),
  milestoneId: Type.Optional(Type.String()),
  parentTaskId: Type.Optional(Type.String()),
  dependencies: Type.Array(Type.Object({ taskId: Type.String(), kind: Type.String() })),
  assignee: Type.Optional(Type.String()),
  acceptanceCriteria: Type.Array(Type.Object({ id: Type.String(), description: Type.String(), satisfied: Type.Boolean() })),
  revision: Type.Integer(),
});

const CreateTaskBodySchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  type: Type.String(),
  priority: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  milestoneId: Type.Optional(Type.String()),
  parentTaskId: Type.Optional(Type.String()),
  dependencies: Type.Optional(Type.Array(Type.Object({ taskId: Type.String(), kind: Type.String() }))),
  assignee: Type.Optional(Type.String()),
  acceptanceCriteria: Type.Optional(Type.Array(Type.Object({ id: Type.String(), description: Type.String(), satisfied: Type.Boolean() }))),
});

const TransitionBodySchema = Type.Object({ status: Type.String() });
const AssignBodySchema = Type.Object({ assignee: Type.String() });

const ResultBodySchema = Type.Object({
  outcome: Type.Union([Type.Literal('success'), Type.Literal('failure'), Type.Literal('partial'), Type.Literal('indeterminate')]),
  summary: Type.String(),
  evidenceIds: Type.Optional(Type.Array(Type.String())),
  artifacts: Type.Optional(Type.Array(Type.String())),
});

/**
 * TASK-013 — Task control API. Task owns the work request; workflow/agent own
 * execution. Completion requires recorded evidence.
 */
export const taskRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const service = app.application.container.resolve<TaskService>('task.service');

  app.get(
    '/api/v2/tasks',
    {
      schema: {
        tags: ['tasks'],
        summary: 'List tasks',
        querystring: Type.Object({ status: Type.Optional(Type.String()), milestoneId: Type.Optional(Type.String()) }),
        response: { 200: Type.Array(TaskViewSchema) },
      },
    },
    async (request, reply) => {
      const tasks = service.listTasks({
        ...(request.query.status !== undefined ? { status: request.query.status as never } : {}),
        ...(request.query.milestoneId !== undefined ? { milestoneId: request.query.milestoneId } : {}),
      });
      return reply.send(tasks.map(toView) as never);
    },
  );

  app.post(
    '/api/v2/tasks',
    {
      schema: {
        tags: ['tasks'],
        summary: 'Create a task',
        body: CreateTaskBodySchema,
        response: { 201: TaskViewSchema },
      },
    },
    async (request, reply) => reply.status(201).send(toView(service.createTask(request.body as never)) as never),
  );

  app.get(
    '/api/v2/tasks/:id',
    {
      schema: {
        tags: ['tasks'],
        summary: 'Get a task',
        params: Type.Object({ id: Type.String() }),
        response: { 200: TaskViewSchema },
      },
    },
    async (request, reply) => reply.send(toView(service.getTask(request.params.id)) as never),
  );

  app.get(
    '/api/v2/tasks/dependencies',
    {
      schema: {
        tags: ['tasks'],
        summary: 'Validate the task dependency graph (cycle detection)',
        response: { 200: Type.Object({ ok: Type.Boolean(), cycles: Type.Array(Type.Array(Type.String())) }) },
      },
    },
    async (_request, reply) => reply.send(service.validateDependencies() as never),
  );

  app.post(
    '/api/v2/tasks/:id/assign',
    {
      schema: {
        tags: ['tasks'],
        summary: 'Assign a task',
        params: Type.Object({ id: Type.String() }),
        body: AssignBodySchema,
        response: { 200: TaskViewSchema },
      },
    },
    async (request, reply) => reply.send(toView(service.assign(request.params.id, request.body.assignee)) as never),
  );

  app.post(
    '/api/v2/tasks/:id/transition',
    {
      schema: {
        tags: ['tasks'],
        summary: 'Transition a task to a new status',
        params: Type.Object({ id: Type.String() }),
        body: TransitionBodySchema,
        response: { 200: TaskViewSchema, 400: Type.Object({ error: Type.Object({ code: Type.String(), message: Type.String() }) }) },
      },
    },
    async (request, reply) => {
      try {
        return reply.send(toView(service.transition(request.params.id, request.body.status as never)) as never);
      } catch (err) {
        return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: (err as Error).message } } as never);
      }
    },
  );

  app.post(
    '/api/v2/tasks/:id/results',
    {
      schema: {
        tags: ['tasks'],
        summary: 'Record a task execution result (completion requires evidence)',
        params: Type.Object({ id: Type.String() }),
        body: ResultBodySchema,
        response: {
          200: Type.Object({ taskId: Type.String(), outcome: Type.String(), summary: Type.String(), evidenceIds: Type.Array(Type.String()), completedAt: Type.String() }),
        },
      },
    },
    async (request, reply) => reply.send(service.recordResult({ taskId: request.params.id, ...request.body }) as never),
  );

  app.get(
    '/api/v2/tasks/:id/results',
    {
      schema: {
        tags: ['tasks'],
        summary: 'Task execution history',
        params: Type.Object({ id: Type.String() }),
        response: {
          200: Type.Array(Type.Object({ taskId: Type.String(), outcome: Type.String(), summary: Type.String(), evidenceIds: Type.Array(Type.String()), completedAt: Type.String() })),
        },
      },
    },
    async (request, reply) => reply.send(service.results(request.params.id) as never),
  );

  app.get(
    '/api/v2/tasks/events',
    {
      schema: {
        tags: ['tasks'],
        summary: 'Task events',
        response: { 200: Type.Array(Type.Object({ type: Type.String(), taskId: Type.String(), at: Type.String() })) },
      },
    },
    async (_request, reply) => reply.send(service.listEvents() as never),
  );
};

function toView(t: {
  id: string; title: string; type: string; status: string; priority: string;
  milestoneId?: string; parentTaskId?: string; dependencies: readonly { taskId: string; kind: string }[];
  assignee?: string; acceptanceCriteria: readonly { id: string; description: string; satisfied: boolean }[]; revision: number;
}) {
  return {
    id: t.id,
    title: t.title,
    type: t.type,
    status: t.status,
    priority: t.priority,
    ...(t.milestoneId !== undefined ? { milestoneId: t.milestoneId } : {}),
    ...(t.parentTaskId !== undefined ? { parentTaskId: t.parentTaskId } : {}),
    dependencies: t.dependencies,
    ...(t.assignee !== undefined ? { assignee: t.assignee } : {}),
    acceptanceCriteria: t.acceptanceCriteria,
    revision: t.revision,
  };
}
