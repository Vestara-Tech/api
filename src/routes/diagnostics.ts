import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { DiagnosticExecutor } from '../diagnostics/executor.js';
import type { DiagnosticRegistry } from '../diagnostics/registry.js';

const CheckViewSchema = Type.Object({ checkId: Type.String(), name: Type.String(), category: Type.String(), risk: Type.String(), moduleId: Type.String() });

const RunResultSchema = Type.Object({
  id: Type.String(),
  scope: Type.String(),
  target: Type.Optional(Type.String()),
  status: Type.String(),
  startedAt: Type.String(),
  completedAt: Type.Optional(Type.String()),
  counts: Type.Object({ healthy: Type.Integer(), degraded: Type.Integer(), failed: Type.Integer() }),
  findings: Type.Array(
    Type.Object({
      id: Type.String(),
      checkId: Type.String(),
      severity: Type.String(),
      status: Type.String(),
      message: Type.String(),
      at: Type.String(),
    }),
  ),
});

const RunBodySchema = Type.Object({
  scope: Type.String(),
  target: Type.Optional(Type.String()),
  moduleId: Type.Optional(Type.String()),
});

/**
 * DIAG-019 — Diagnostics control API. Checks, runs, findings. Diagnostics
 * observes and investigates; it never repairs.
 */
export const diagnosticsRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const registry = app.application.container.resolve<DiagnosticRegistry>('diagnostics.registry');
  const executor = app.application.container.resolve<DiagnosticExecutor>('diagnostics.executor');

  app.get(
    '/api/v2/diagnostics/checks',
    {
      schema: {
        tags: ['diagnostics'],
        summary: 'List registered diagnostic checks',
        response: { 200: Type.Array(CheckViewSchema) },
      },
    },
    async (_request, reply) => reply.send(registry.listChecks() as never),
  );

  app.post(
    '/api/v2/diagnostics/run',
    {
      schema: {
        tags: ['diagnostics'],
        summary: 'Run diagnostics (system or a module target)',
        body: RunBodySchema,
        response: { 200: RunResultSchema },
      },
    },
    async (request, reply) => {
      const run = await executor.run(request.body as never);
      return reply.send(toView(run) as never);
    },
  );

  app.get(
    '/api/v2/diagnostics/runs',
    {
      schema: {
        tags: ['diagnostics'],
        summary: 'List diagnostic runs',
        response: { 200: Type.Array(RunResultSchema) },
      },
    },
    async (_request, reply) => reply.send(executor.listRuns().map(toView) as never),
  );

  app.get(
    '/api/v2/diagnostics/runs/:id',
    {
      schema: {
        tags: ['diagnostics'],
        summary: 'Get a diagnostic run',
        params: Type.Object({ id: Type.String() }),
        response: { 200: RunResultSchema },
      },
    },
    async (request, reply) => reply.send(toView(executor.getRun(request.params.id)) as never),
  );
};

function toView(run: ReturnType<DiagnosticExecutor['getRun']>) {
  return {
    id: run.id,
    scope: run.scope,
    ...(run.target !== undefined ? { target: run.target } : {}),
    status: run.status,
    startedAt: run.startedAt,
    ...(run.completedAt !== undefined ? { completedAt: run.completedAt } : {}),
    counts: run.counts,
    findings: run.findings.map((f) => ({ id: f.id, checkId: f.checkId, severity: f.severity, status: f.status, message: f.message, at: f.at })),
  };
}
