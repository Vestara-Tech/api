import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { TestService } from '../test/service/test-service.js';
import type { TestRunnerRegistry } from '../test/registry/test-runner-registry.js';

const TestDefinitionSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  kind: Type.String(),
  target: Type.String(),
  runner: Type.String(),
  configuration: Type.Record(Type.String(), Type.Any()),
  requirements: Type.Array(Type.String()),
  tags: Type.Array(Type.String()),
});

const SuiteSchema = Type.Object({ id: Type.String(), name: Type.String(), tests: Type.Array(TestDefinitionSchema) });

const CreateSuiteBodySchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  tests: Type.Array(TestDefinitionSchema),
});

const RunResultSchema = Type.Object({
  id: Type.String(),
  suiteId: Type.String(),
  status: Type.String(),
  total: Type.Integer(),
  passed: Type.Integer(),
  failed: Type.Integer(),
  skipped: Type.Integer(),
  evidenceHash: Type.String(),
  runner: Type.String(),
});

/**
 * TEST-024 — Test control API. Suites, runners, runs with machine-verifiable
 * evidence hashes. Test exercises; Verifier evaluates separately.
 */
export const testRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const service = app.application.container.resolve<TestService>('test.service');
  const registry = app.application.container.resolve<TestRunnerRegistry>('test.registry');

  app.get(
    '/api/v2/tests/runners',
    {
      schema: {
        tags: ['tests'],
        summary: 'List test runners',
        response: { 200: Type.Array(Type.Object({ id: Type.String(), supportedKinds: Type.Array(Type.String()) })) },
      },
    },
    async (_request, reply) => reply.send(registry.list().map((c) => ({ id: c.id, supportedKinds: c.supportedKinds })) as never),
  );

  app.get(
    '/api/v2/tests/suites',
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
    '/api/v2/tests/suites',
    {
      schema: {
        tags: ['tests'],
        summary: 'Create a test suite',
        body: CreateSuiteBodySchema,
        response: { 201: SuiteSchema },
      },
    },
    async (request, reply) => reply.status(201).send(service.createSuite(request.body as never) as never),
  );

  app.post(
    '/api/v2/tests/suites/:id/run',
    {
      schema: {
        tags: ['tests'],
        summary: 'Run a test suite (adapter per test kind)',
        params: Type.Object({ id: Type.String() }),
        response: { 200: RunResultSchema },
      },
    },
    async (request, reply) => {
      const run = await service.run(request.params.id);
      return reply.send(run as never);
    },
  );
};
