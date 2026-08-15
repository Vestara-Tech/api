import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { TestService } from '../test/service/test-service.js';
import type { TestRunnerRegistry } from '../test/registry/test-runner-registry.js';

const TestDefinitionSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  type: Type.String(),
  target: Type.String(),
  runnerId: Type.String(),
  requirements: Type.Array(Type.Object({ id: Type.String(), description: Type.String(), required: Type.Boolean() })),
  parameters: Type.Record(Type.String(), Type.Any()),
  tags: Type.Array(Type.String()),
});

const SuiteSchema = Type.Object({ id: Type.String(), name: Type.String(), tests: Type.Array(TestDefinitionSchema) });

const ProfileSchema = Type.Object({ id: Type.String(), name: Type.String(), types: Type.Array(Type.String()), tags: Type.Array(Type.String()) });

const PlanSchema = Type.Object({ id: Type.String(), name: Type.String(), objective: Type.String(), target: Type.String(), suiteIds: Type.Array(Type.String()), profileId: Type.String() });

const RunResultSchema = Type.Object({
  id: Type.String(),
  target: Type.String(),
  status: Type.String(),
  summary: Type.Object({ total: Type.Integer(), passed: Type.Integer(), failed: Type.Integer(), skipped: Type.Integer() }),
  evidenceId: Type.Optional(Type.String()),
});

const RunBodySchema = Type.Object({ suiteId: Type.String(), profileId: Type.String() });

const ImpactBodySchema = Type.Object({
  changedArtifacts: Type.Array(Type.String()),
  capabilityOf: Type.Record(Type.String(), Type.Array(Type.String())),
  testsOf: Type.Record(Type.String(), Type.Array(Type.String())),
});

/**
 * TEST-031 — expanded Test control API. Suites, plans, profiles, runs,
 * runners, flaky, impact.
 */
export const testRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const service = app.application.container.resolve<TestService>('test.service');
  const registry = app.application.container.resolve<TestRunnerRegistry>('test.registry');

  app.get(
    '/api/v2/test/runners',
    {
      schema: {
        tags: ['tests'],
        summary: 'List test runners and their capabilities',
        response: { 200: Type.Array(Type.Object({ id: Type.String(), capabilities: Type.Array(Type.String()) })) },
      },
    },
    async (_request, reply) => reply.send(registry.list().map((r) => ({ id: r.id, capabilities: r.capabilities })) as never),
  );

  app.get(
    '/api/v2/test/suites',
    {
      schema: {
        tags: ['tests'],
        summary: 'List test suites',
        response: { 200: Type.Array(SuiteSchema) },
      },
    },
    async (_request, reply) => reply.send(service.listSuites() as never),
  );

  app.post(
    '/api/v2/test/suites',
    {
      schema: {
        tags: ['tests'],
        summary: 'Create a test suite',
        body: Type.Object({ id: Type.String(), name: Type.String(), tests: Type.Array(TestDefinitionSchema) }),
        response: { 201: SuiteSchema },
      },
    },
    async (request, reply) => reply.status(201).send(service.createSuite(request.body as never) as never),
  );

  app.get(
    '/api/v2/test/plans',
    {
      schema: {
        tags: ['tests'],
        summary: 'List test plans',
        response: { 200: Type.Array(PlanSchema) },
      },
    },
    async (_request, reply) => reply.send(service.listPlans() as never),
  );

  app.post(
    '/api/v2/test/plans',
    {
      schema: {
        tags: ['tests'],
        summary: 'Create a test plan',
        body: Type.Object({ id: Type.String(), name: Type.String(), objective: Type.String(), target: Type.String(), suiteIds: Type.Array(Type.String()), profileId: Type.String() }),
        response: { 201: PlanSchema },
      },
    },
    async (request, reply) => reply.status(201).send(service.createPlan(request.body as never) as never),
  );

  app.get(
    '/api/v2/test/profiles',
    {
      schema: {
        tags: ['tests'],
        summary: 'List test profiles',
        response: { 200: Type.Array(ProfileSchema) },
      },
    },
    async (_request, reply) => reply.send(service.listProfiles() as never),
  );

  app.post(
    '/api/v2/test/profiles',
    {
      schema: {
        tags: ['tests'],
        summary: 'Create a test profile',
        body: Type.Object({ id: Type.String(), name: Type.String(), types: Type.Array(Type.String()), tags: Type.Array(Type.String()) }),
        response: { 201: ProfileSchema },
      },
    },
    async (request, reply) => reply.status(201).send(service.createProfile(request.body as never) as never),
  );

  app.post(
    '/api/v2/test/runs',
    {
      schema: {
        tags: ['tests'],
        summary: 'Run a suite under a profile',
        body: RunBodySchema,
        response: { 200: RunResultSchema },
      },
    },
    async (request, reply) => {
      const run = await service.run(request.body.suiteId, request.body.profileId);
      return reply.send(toRunView(run) as never);
    },
  );

  app.get(
    '/api/v2/test/runs',
    {
      schema: {
        tags: ['tests'],
        summary: 'List test runs',
        response: { 200: Type.Array(RunResultSchema) },
      },
    },
    async (_request, reply) => reply.send(service.listRuns().map(toRunView) as never),
  );

  app.get(
    '/api/v2/test/flaky',
    {
      schema: {
        tags: ['tests'],
        summary: 'Flaky-test analysis',
        querystring: Type.Object({ testId: Type.String() }),
        response: {
          200: Type.Object({ testId: Type.String(), runs: Type.Integer(), passed: Type.Integer(), failed: Type.Integer(), flakiness: Type.Integer(), confidence: Type.String(), classification: Type.String() }),
        },
      },
    },
    async (request, reply) => {
      const result = service.flaky(request.query.testId);
      return reply.send(result ?? { testId: request.query.testId, runs: 0, passed: 0, failed: 0, retried: 0, flakiness: 0, confidence: 'low', classification: 'No history' } as never);
    },
  );

  app.post(
    '/api/v2/test/impact',
    {
      schema: {
        tags: ['tests'],
        summary: 'Impact analysis: changed artifacts -> affected tests',
        body: ImpactBodySchema,
        response: {
          200: Type.Object({ changedArtifacts: Type.Array(Type.String()), affectedCapabilities: Type.Array(Type.String()), affectedTests: Type.Array(Type.String()), recommendedTestCount: Type.Integer() }),
        },
      },
    },
    async (request, reply) => {
      const analysis = service.impact({
        changedArtifacts: request.body.changedArtifacts,
        capabilityOf: (artifact) => request.body.capabilityOf[artifact] ?? [],
        testsOf: (capability) => request.body.testsOf[capability] ?? [],
      });
      return reply.send(analysis as never);
    },
  );
};

function toRunView(run: { id: string; target: string; status: string; summary: { total: number; passed: number; failed: number; skipped: number }; evidenceId?: string }) {
  return {
    id: run.id,
    target: run.target,
    status: run.status,
    summary: run.summary,
    ...(run.evidenceId !== undefined ? { evidenceId: run.evidenceId } : {}),
  };
}
