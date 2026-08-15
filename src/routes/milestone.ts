import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { MilestoneService } from '../milestone/service/milestone-service.js';

const MilestoneViewSchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  objective: Type.String(),
  status: Type.String(),
  parentMilestoneId: Type.Optional(Type.String()),
  taskIds: Type.Array(Type.String()),
  childMilestoneIds: Type.Array(Type.String()),
  progress: Type.Object({ completion: Type.Integer(), execution: Type.Integer(), health: Type.String(), completedTasks: Type.Integer(), totalTasks: Type.Integer(), blockedTasks: Type.Integer() }),
  revision: Type.Integer(),
});

const CreateMilestoneBodySchema = Type.Object({
  id: Type.String(),
  title: Type.String(),
  objective: Type.String(),
  parentMilestoneId: Type.Optional(Type.String()),
  targetDate: Type.Optional(Type.String()),
  successCriteria: Type.Optional(Type.Array(Type.Object({ id: Type.String(), description: Type.String(), satisfied: Type.Boolean() }))),
});

const AddTaskBodySchema = Type.Object({ taskId: Type.String() });
const TransitionBodySchema = Type.Object({ status: Type.String() });

/**
 * MS-012 — Milestone control API. Progress is derived, never PATCHed.
 * Completion requires the verification/evidence gate.
 */
export const milestoneRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const service = app.application.container.resolve<MilestoneService>('milestone.service');

  app.get(
    '/api/v2/milestones',
    {
      schema: {
        tags: ['milestones'],
        summary: 'List milestones',
        response: { 200: Type.Array(MilestoneViewSchema) },
      },
    },
    async (_request, reply) => reply.send(service.listMilestones().map(toView) as never),
  );

  app.post(
    '/api/v2/milestones',
    {
      schema: {
        tags: ['milestones'],
        summary: 'Create a milestone',
        body: CreateMilestoneBodySchema,
        response: { 201: MilestoneViewSchema },
      },
    },
    async (request, reply) => reply.status(201).send(toView(service.createMilestone(request.body as never)) as never),
  );

  app.get(
    '/api/v2/milestones/:id',
    {
      schema: {
        tags: ['milestones'],
        summary: 'Get a milestone',
        params: Type.Object({ id: Type.String() }),
        response: { 200: MilestoneViewSchema },
      },
    },
    async (request, reply) => reply.send(toView(service.getMilestone(request.params.id)) as never),
  );

  app.get(
    '/api/v2/milestones/:id/children',
    {
      schema: {
        tags: ['milestones'],
        summary: 'Sub-milestones',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Array(MilestoneViewSchema) },
      },
    },
    async (request, reply) => reply.send(service.children(request.params.id).map(toView) as never),
  );

  app.post(
    '/api/v2/milestones/:id/tasks',
    {
      schema: {
        tags: ['milestones'],
        summary: 'Add a task to the milestone (recomputes progress)',
        params: Type.Object({ id: Type.String() }),
        body: AddTaskBodySchema,
        response: { 200: MilestoneViewSchema },
      },
    },
    async (request, reply) => reply.send(toView(service.addTask(request.params.id, request.body.taskId)) as never),
  );

  app.get(
    '/api/v2/milestones/:id/progress',
    {
      schema: {
        tags: ['milestones'],
        summary: 'Derived progress',
        params: Type.Object({ id: Type.String() }),
        response: {
          200: Type.Object({ completion: Type.Integer(), execution: Type.Integer(), health: Type.String(), completedTasks: Type.Integer(), totalTasks: Type.Integer(), blockedTasks: Type.Integer() }),
        },
      },
    },
    async (request, reply) => reply.send(service.progressOf(request.params.id) as never),
  );

  app.get(
    '/api/v2/milestones/:id/health',
    {
      schema: {
        tags: ['milestones'],
        summary: 'Milestone health + blocked/critical path',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Object({ health: Type.String(), blockedTasks: Type.Integer(), totalTasks: Type.Integer() }) },
      },
    },
    async (request, reply) => reply.send(service.healthOf(request.params.id) as never),
  );

  app.post(
    '/api/v2/milestones/:id/verify',
    {
      schema: {
        tags: ['milestones'],
        summary: 'Verification/evidence gate',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Object({ ok: Type.Boolean(), reasons: Type.Array(Type.String()) }) },
      },
    },
    async (request, reply) => reply.send(service.verify(request.params.id) as never),
  );

  app.post(
    '/api/v2/milestones/:id/complete',
    {
      schema: {
        tags: ['milestones'],
        summary: 'Complete a milestone (requires evidence gate)',
        params: Type.Object({ id: Type.String() }),
        response: { 200: MilestoneViewSchema, 400: Type.Object({ error: Type.Object({ code: Type.String(), message: Type.String() }) }) },
      },
    },
    async (request, reply) => {
      try {
        const result = service.complete(request.params.id);
        return reply.send(toView(result.milestone) as never);
      } catch (err) {
        return reply.status(400).send({ error: { code: 'BAD_REQUEST', message: (err as Error).message } } as never);
      }
    },
  );

  app.get(
    '/api/v2/milestones/events',
    {
      schema: {
        tags: ['milestones'],
        summary: 'Milestone events',
        response: { 200: Type.Array(Type.Object({ type: Type.String(), milestoneId: Type.String(), at: Type.String() })) },
      },
    },
    async (_request, reply) => reply.send(service.events() as never),
  );
};

function toView(m: {
  id: string; title: string; objective: string; status: string; parentMilestoneId?: string;
  taskIds: readonly string[]; childMilestoneIds: readonly string[];
  progress: { completion: number; execution: number; health: string; completedTasks: number; totalTasks: number; blockedTasks: number };
  revision: number;
}) {
  return {
    id: m.id,
    title: m.title,
    objective: m.objective,
    status: m.status,
    ...(m.parentMilestoneId !== undefined ? { parentMilestoneId: m.parentMilestoneId } : {}),
    taskIds: m.taskIds,
    childMilestoneIds: m.childMilestoneIds,
    progress: m.progress,
    revision: m.revision,
  };
}
