import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { RuntimeSelector } from '../car/runtime/runtime-selector.js';
import type { CodingAgentRuntimeRegistry } from '../car/registry/coding-agent-runtime-registry.js';
import type { ToolGateway } from '../car/runtime/tool-gateway.js';

const RuntimeViewSchema = Type.Object({
  id: Type.String(),
  streaming: Type.Boolean(),
  sessions: Type.Boolean(),
  resumableSessions: Type.Boolean(),
  tools: Type.Boolean(),
  filesystem: Type.Boolean(),
  shell: Type.Boolean(),
  structuredOutput: Type.Boolean(),
  repositoryContext: Type.Boolean(),
  approvals: Type.Boolean(),
  cancellation: Type.Boolean(),
});

const SelectBodySchema = Type.Object({
  runtime: Type.Union([Type.Literal('vestara'), Type.Literal('auto'), Type.Literal('opencode'), Type.Literal('claude-code'), Type.Literal('codex'), Type.Literal('gemini')]),
  fallback: Type.Optional(Type.Array(Type.String())),
  requirements: Type.Optional(
    Type.Object({
      repositoryEditing: Type.Optional(Type.Boolean()),
      terminal: Type.Optional(Type.Boolean()),
      tools: Type.Optional(Type.Boolean()),
      resumableSessions: Type.Optional(Type.Boolean()),
      structuredOutput: Type.Optional(Type.Boolean()),
    }),
  ),
});

const SessionBodySchema = Type.Object({
  agentId: Type.String(),
  runId: Type.String(),
  workspace: Type.Optional(Type.String()),
  objective: Type.Optional(Type.String()),
});

const GatewayBodySchema = Type.Object({
  runtimeId: Type.String(),
  sessionId: Type.String(),
  agentId: Type.String(),
  toolId: Type.String(),
  input: Type.Optional(Type.Any()),
  principalId: Type.Optional(Type.String()),
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
 * CAR — Control API. Runtimes, capability discovery, selection, sessions and
 * the governed Tool Gateway. External coding runtimes request tools through
 * the gateway; Vestara owns authorization + approval + evidence.
 */
export const carRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const selector = app.application.container.resolve<RuntimeSelector>('car');
  const registry = app.application.container.resolve<CodingAgentRuntimeRegistry>('car.registry');
  const gateway = app.application.container.resolve<ToolGateway>('car.gateway');

  app.get(
    '/api/v2/car/runtimes',
    {
      schema: {
        tags: ['car'],
        summary: 'List coding agent runtimes and their capabilities',
        response: { 200: Type.Array(RuntimeViewSchema) },
      },
    },
    async (_request, reply) => {
      const views = await Promise.all(
        registry.list().map(async (r) => {
          const c = await r.capabilities();
          return {
            id: r.id,
            streaming: c.streaming,
            sessions: c.sessions,
            resumableSessions: c.resumableSessions,
            tools: c.tools,
            filesystem: c.filesystem,
            shell: c.shell,
            structuredOutput: c.structuredOutput,
            repositoryContext: c.repositoryContext,
            approvals: c.approvals,
            cancellation: c.cancellation,
          };
        }),
      );
      return reply.send(views as never);
    },
  );

  app.post(
    '/api/v2/car/select',
    {
      schema: {
        tags: ['car'],
        summary: 'Select a runtime for an agent runtime policy (auto/fallback)',
        body: SelectBodySchema,
        response: {
          200: Type.Object({
            runtimeId: Type.String(),
            viaFallback: Type.Boolean(),
            capabilities: RuntimeViewSchema,
          }),
        },
      },
    },
    async (request, reply) => {
      const selected = await selector.select(request.body as never);
      return reply.send({
        runtimeId: selected.runtimeId,
        viaFallback: selected.viaFallback,
        capabilities: {
          id: selected.runtimeId,
          streaming: selected.capabilities.streaming,
          sessions: selected.capabilities.sessions,
          resumableSessions: selected.capabilities.resumableSessions,
          tools: selected.capabilities.tools,
          filesystem: selected.capabilities.filesystem,
          shell: selected.capabilities.shell,
          structuredOutput: selected.capabilities.structuredOutput,
          repositoryContext: selected.capabilities.repositoryContext,
          approvals: selected.capabilities.approvals,
          cancellation: selected.capabilities.cancellation,
        },
      } as never);
    },
  );

  app.get(
    '/api/v2/car/health',
    {
      schema: {
        tags: ['car'],
        summary: 'Runtime health',
        response: {
          200: Type.Array(Type.Object({ runtimeId: Type.String(), healthy: Type.Boolean(), message: Type.Optional(Type.String()) })),
        },
      },
    },
    async (_request, reply) => reply.send(await selector.health() as never),
  );

  app.post(
    '/api/v2/car/sessions',
    {
      schema: {
        tags: ['car'],
        summary: 'Create a coding agent session',
        body: SessionBodySchema,
        response: { 201: Type.Object({ id: Type.String(), runtimeId: Type.String(), providerSessionId: Type.String(), resumed: Type.Boolean(), createdAt: Type.String() }) },
      },
    },
    async (request, reply) => {
      const selected = await selector.select({ runtime: 'auto' });
      const runtime = registry.get(selected.runtimeId);
      const session = await runtime.createSession(request.body as never);
      return reply.status(201).send(session as never);
    },
  );

  app.post(
    '/api/v2/car/gateway/execute',
    {
      schema: {
        tags: ['car'],
        summary: 'Execute a tool request from an external coding runtime (governed)',
        body: GatewayBodySchema,
        response: {
          200: Type.Object({
            ok: Type.Boolean(),
            output: Type.Optional(Type.Any()),
            error: Type.Optional(Type.String()),
            approved: Type.Boolean(),
            approvalRequired: Type.Boolean(),
          }),
        },
      },
    },
    async (request, reply) => {
      const result = await gateway.execute(request.body as never);
      return reply.send(result as never);
    },
  );
};
