import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { AgentRuntime } from '../agent/runtime/agent-runtime.js';
import type { AgentRegistry } from '../agent/registry/agent-registry.js';
import type { AgentRunStateMachine } from '../agent/runtime/run-state-machine.js';
import type { ToolRegistry } from '../tool/registry/tool-registry.js';
import type { ToolRuntime } from '../tool/runtime/tool-runtime.js';
import type { SkillRegistry } from '../skill/registry/skill-registry.js';

const AgentViewSchema = Type.Object({
  id: Type.String(),
  version: Type.String(),
  name: Type.String(),
  role: Type.String(),
  tools: Type.Array(Type.Object({ id: Type.String() })),
  skills: Type.Array(Type.Object({ id: Type.String() })),
  permissions: Type.Array(Type.String()),
});

const RunViewSchema = Type.Object({
  id: Type.String(),
  agentId: Type.String(),
  status: Type.String(),
  startedAt: Type.Optional(Type.String()),
  completedAt: Type.Optional(Type.String()),
  result: Type.Optional(Type.String()),
  error: Type.Optional(Type.String()),
});

const RunEventSchema = Type.Object({
  runId: Type.String(),
  type: Type.String(),
  at: Type.String(),
  data: Type.Optional(Type.Any()),
});

const StartRunBodySchema = Type.Object({
  agentId: Type.String(),
  goal: Type.String(),
  principalId: Type.Optional(Type.String()),
});

const ToolViewSchema = Type.Object({
  id: Type.String(),
  version: Type.String(),
  description: Type.String(),
  capabilities: Type.Array(Type.String()),
  risk: Type.String(),
});

const SkillViewSchema = Type.Object({
  id: Type.String(),
  version: Type.String(),
  name: Type.String(),
  description: Type.String(),
  requiredCapabilities: Type.Array(Type.String()),
  compatibleRoles: Type.Optional(Type.Array(Type.String())),
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
 * AGENT-024 — Agent control API. Agents, runs (+ events, cancel/resume),
 * tools and skills. Normal AuthorizationService policy still applies; the API
 * does not expose arbitrary unrestricted tool execution.
 */
export const agentRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const runtime = app.application.container.resolve<AgentRuntime>('agents');
  const agents = app.application.container.resolve<AgentRegistry>('agent.registry');
  const runs = app.application.container.resolve<AgentRunStateMachine>('agent.runs');
  const tools = app.application.container.resolve<ToolRegistry>('tools');
  const skills = app.application.container.resolve<SkillRegistry>('skills');

  // ── Agents ───────────────────────────────────────────────
  app.get(
    '/api/v2/agents',
    {
      schema: {
        tags: ['agents'],
        summary: 'List agents',
        response: { 200: Type.Array(AgentViewSchema) },
      },
    },
    async (_request, reply) =>
      reply.send(
        agents.list().map((a) => ({ id: a.id, version: a.version, name: a.name, role: a.role, tools: a.tools, skills: a.skills, permissions: a.permissions })) as never,
      ),
  );

  app.get(
    '/api/v2/agents/:id',
    {
      schema: {
        tags: ['agents'],
        summary: 'Get an agent',
        params: Type.Object({ id: Type.String() }),
        response: { 200: AgentViewSchema, 404: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      const a = agents.get(request.params.id);
      return reply.send({ id: a.id, version: a.version, name: a.name, role: a.role, tools: a.tools, skills: a.skills, permissions: a.permissions } as never);
    },
  );

  app.get(
    '/api/v2/agents/:id/runs',
    {
      schema: {
        tags: ['agents'],
        summary: 'List runs for an agent',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Array(RunViewSchema) },
      },
    },
    async (request, reply) => reply.send(runs.list(request.params.id) as never),
  );

  // ── Runs ─────────────────────────────────────────────────
  app.post(
    '/api/v2/agent-runs',
    {
      schema: {
        tags: ['agents'],
        summary: 'Start an agent run',
        body: StartRunBodySchema,
        response: { 201: RunViewSchema, 404: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      const run = runtime.start({
        agentId: request.body.agentId,
        goal: request.body.goal,
        ...(request.body.principalId !== undefined ? { principalId: request.body.principalId } : {}),
      });
      return reply.status(201).send(run as never);
    },
  );

  app.get(
    '/api/v2/agent-runs/:id',
    {
      schema: {
        tags: ['agents'],
        summary: 'Get a run',
        params: Type.Object({ id: Type.String() }),
        response: { 200: RunViewSchema, 404: ApiErrorSchema },
      },
    },
    async (request, reply) => reply.send(runs.get(request.params.id) as never),
  );

  app.get(
    '/api/v2/agent-runs/:id/events',
    {
      schema: {
        tags: ['agents'],
        summary: 'Get run events',
        params: Type.Object({ id: Type.String() }),
        response: { 200: Type.Array(RunEventSchema) },
      },
    },
    async (request, reply) => reply.send(runs.eventsFor(request.params.id) as never),
  );

  app.post(
    '/api/v2/agent-runs/:id/cancel',
    {
      schema: {
        tags: ['agents'],
        summary: 'Cancel a run',
        params: Type.Object({ id: Type.String() }),
        response: { 200: RunViewSchema, 404: ApiErrorSchema },
      },
    },
    async (request, reply) => reply.send(runtime.cancel(request.params.id) as never),
  );

  app.post(
    '/api/v2/agent-runs/:id/resume',
    {
      schema: {
        tags: ['agents'],
        summary: 'Resume a suspended run',
        params: Type.Object({ id: Type.String() }),
        response: { 200: RunViewSchema, 404: ApiErrorSchema },
      },
    },
    async (request, reply) => reply.send(runtime.resume(request.params.id) as never),
  );

  // ── Tools ─────────────────────────────────────────────────
  app.get(
    '/api/v2/tools',
    {
      schema: {
        tags: ['agents'],
        summary: 'List tools',
        response: { 200: Type.Array(ToolViewSchema) },
      },
    },
    async (_request, reply) =>
      reply.send(
        tools.list().map((t) => ({ id: t.id, version: t.version, description: t.description, capabilities: t.capabilities, risk: t.risk })) as never,
      ),
  );

  app.get(
    '/api/v2/tools/:id',
    {
      schema: {
        tags: ['agents'],
        summary: 'Get a tool',
        params: Type.Object({ id: Type.String() }),
        response: { 200: ToolViewSchema, 404: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      const t = tools.get(request.params.id);
      return reply.send({ id: t.id, version: t.version, description: t.description, capabilities: t.capabilities, risk: t.risk } as never);
    },
  );

  // ── Skills ────────────────────────────────────────────────
  app.get(
    '/api/v2/skills',
    {
      schema: {
        tags: ['agents'],
        summary: 'List skills',
        response: { 200: Type.Array(SkillViewSchema) },
      },
    },
    async (_request, reply) =>
      reply.send(
        skills.list().map((s) => ({
          id: s.id,
          version: s.version,
          name: s.name,
          description: s.description,
          requiredCapabilities: s.requiredCapabilities,
          ...(s.compatibleRoles !== undefined ? { compatibleRoles: s.compatibleRoles } : {}),
        })) as never,
      ),
  );

  app.get(
    '/api/v2/skills/:id',
    {
      schema: {
        tags: ['agents'],
        summary: 'Get a skill',
        params: Type.Object({ id: Type.String() }),
        response: { 200: SkillViewSchema, 404: ApiErrorSchema },
      },
    },
    async (request, reply) => {
      const s = skills.get(request.params.id);
      return reply.send({
        id: s.id,
        version: s.version,
        name: s.name,
        description: s.description,
        requiredCapabilities: s.requiredCapabilities,
        ...(s.compatibleRoles !== undefined ? { compatibleRoles: s.compatibleRoles } : {}),
      } as never);
    },
  );
};
