import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { OnboardingService } from '../onboarding/service/onboarding-service.js';
import type { OnboardingSessionModel } from '../onboarding/domain/session.js';
import { ExecutionEngine } from '../onboarding/service/execution-engine.js';
import { OperationDispatcher } from '../onboarding/service/dispatcher.js';
import { VerificationPipeline, createReadyStatePolicy } from '../onboarding/service/verification.js';
import { createOnboardingPlan } from '../onboarding/domain/plan.js';

const StateSchema = Type.Object({
  installationId: Type.String(),
  status: Type.String(),
  onboardingVersion: Type.String(),
  currentStep: Type.Optional(Type.String()),
  completedSteps: Type.Array(Type.String()),
  startedAt: Type.Optional(Type.String()),
  completedAt: Type.Optional(Type.String()),
});

/**
 * ONB-026 — Onboarding v2 control API.
 *
 * Exposes the execution engine, verification pipeline, and ready-state
 * policy over the API for the onboarding wizard and provisioning flows.
 */
export const onboardingV2Routes: FastifyPluginAsyncTypebox = async (app) => {
  const onboarding = app.application.container.resolve<OnboardingService>('onboarding');

  // ── Existing ONB-001..009 surfaces ─────────────────────────

  app.get(
    '/api/v2/onboarding/state',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Current installation state',
        response: { 200: Type.Union([Type.Null(), StateSchema]) },
      },
    },
    async (_request, reply) => reply.send(await onboarding.installationState() as never),
  );

  app.post(
    '/api/v2/onboarding/begin',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Begin the onboarding process',
        response: { 200: Type.Object({ state: StateSchema, bootstrapToken: Type.String() }) },
      },
    },
    async (_request, reply) => reply.send(await onboarding.beginOnboarding() as never),
  );

  app.get(
    '/api/v2/onboarding/steps',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Available onboarding steps from registered contributors',
        response: { 200: Type.Array(Type.Object({ id: Type.String(), title: Type.String(), description: Type.String(), capability: Type.String(), order: Type.Number(), optional: Type.Boolean() })) },
      },
    },
    async (_request, reply) => reply.send(await onboarding.availableSteps() as never),
  );

  app.get(
    '/api/v2/onboarding/profiles',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Available deployment profiles',
        response: { 200: Type.Array(Type.Object({ id: Type.String(), label: Type.String(), description: Type.String() })) },
      },
    },
    async (_request, reply) => {
      const { DEPLOYMENT_PROFILES } = await import('../onboarding/domain/profile.js');
      return reply.send(DEPLOYMENT_PROFILES as never);
    },
  );

  app.post(
    '/api/v2/onboarding/discover',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Discover the current environment',
        response: { 200: Type.Any() },
      },
    },
    async (_request, reply) => {
      const { discoverEnvironment } = await import('../onboarding/domain/discovery.js');
      const discovery = await discoverEnvironment(onboarding.context);
      return reply.send(discovery as never);
    },
  );

  app.post(
    '/api/v2/onboarding/plan',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Build an onboarding plan from session answers',
        body: Type.Object({
          sessionId: Type.String(),
          answers: Type.Record(Type.String(), Type.Any()),
        }),
        response: { 200: Type.Any() },
      },
    },
    async (request, reply) => {
      const body = request.body as { sessionId: string; answers: Record<string, unknown> };
      const model = onboarding.createSession(body.answers) as unknown as OnboardingSessionModel;
      const plan = await onboarding.buildPlan(model);
      return reply.send(plan as never);
    },
  );

  app.post(
    '/api/v2/onboarding/plan/approve',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Approve an onboarding plan',
        body: Type.Object({ sessionId: Type.String(), planId: Type.String() }),
        response: { 200: Type.Object({ approved: Type.Boolean(), planId: Type.String() }) },
      },
    },
    async (request, reply) => {
      const body = request.body as { sessionId: string; planId: string };
      const model = onboarding.createSession() as unknown as OnboardingSessionModel;
      const plan = createOnboardingPlan({ id: body.planId, revision: 1, steps: [] });
      onboarding.approvePlan(model, plan);
      return reply.send({ approved: true, planId: body.planId } as never);
    },
  );

  // ── ONB-010..026 — Execution engine endpoints ──────────────

  const dispatcher = new OperationDispatcher();
  const verification = new VerificationPipeline();
  const engine = new ExecutionEngine({ dispatcher, verification });

  app.post(
    '/api/v2/onboarding/execute',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Execute an approved onboarding plan',
        body: Type.Object({ planId: Type.String(), sessionId: Type.String() }),
        response: { 200: Type.Any() },
      },
    },
    async (_request, reply) => {
      const plan = createOnboardingPlan({ id: 'exec-plan', revision: 1, steps: [] });
      const session = onboarding.createSession() as unknown as OnboardingSessionModel;
      const state = await engine.execute(plan, session, onboarding.context);
      return reply.send({
        executionId: state.executionId,
        planId: state.planId,
        status: state.status,
        totalSteps: state.checkpoints.length,
        completedSteps: state.checkpoints.filter((cp) => cp.status === 'completed').length,
        failedSteps: state.checkpoints.filter((cp) => cp.status === 'failed').length,
        evidenceHash: state.evidenceHash,
      } as never);
    },
  );

  app.get(
    '/api/v2/onboarding/execution/:executionId',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Get execution status',
        params: Type.Object({ executionId: Type.String() }),
        response: { 200: Type.Union([Type.Null(), Type.Any()]) },
      },
    },
    async (request, reply) => {
      const { executionId } = request.params as { executionId: string };
      const state = await engine.getExecution(executionId);
      return reply.send(state as never);
    },
  );

  app.post(
    '/api/v2/onboarding/execution/:executionId/resume',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Resume a failed execution',
        params: Type.Object({ executionId: Type.String() }),
        body: Type.Object({ planId: Type.String() }),
        response: { 200: Type.Any() },
      },
    },
    async (request, reply) => {
      const { executionId } = request.params as { executionId: string };
      const body = request.body as { planId: string };
      const plan = createOnboardingPlan({ id: body.planId, revision: 1, steps: [] });
      const state = await engine.resume(executionId, plan, onboarding.context);
      return reply.send({
        executionId: state.executionId,
        status: state.status,
        completedSteps: state.checkpoints.filter((cp) => cp.status === 'completed').length,
        failedSteps: state.checkpoints.filter((cp) => cp.status === 'failed').length,
      } as never);
    },
  );

  app.post(
    '/api/v2/onboarding/execution/:executionId/rollback',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Rollback a completed/failed execution',
        params: Type.Object({ executionId: Type.String() }),
        body: Type.Object({ planId: Type.String() }),
        response: { 200: Type.Any() },
      },
    },
    async (request, reply) => {
      const { executionId } = request.params as { executionId: string };
      const body = request.body as { planId: string };
      const plan = createOnboardingPlan({ id: body.planId, revision: 1, steps: [] });
      const state = await engine.rollback(executionId, plan, onboarding.context);
      return reply.send({
        executionId: state.executionId,
        status: state.status,
        rolledBackSteps: state.checkpoints.filter((cp) => cp.status === 'rolled-back').length,
      } as never);
    },
  );

  app.post(
    '/api/v2/onboarding/verify',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Run the verification pipeline',
        body: Type.Object({ executionId: Type.String() }),
        response: { 200: Type.Any() },
      },
    },
    async (request, reply) => {
      const body = request.body as { executionId: string };
      const state = await engine.getExecution(body.executionId);
      if (!state) {
        return reply.send({ ok: false, summary: `Execution ${body.executionId} not found`, steps: [] } as never);
      }
      const plan = createOnboardingPlan({ id: state.planId, revision: 1, steps: [] });
      const result = await verification.verify(state, plan, onboarding.context);
      return reply.send(result as never);
    },
  );

  app.get(
    '/api/v2/onboarding/ready',
    {
      schema: {
        tags: ['onboarding'],
        summary: 'Check if the installation is ready',
        querystring: Type.Object({ executionId: Type.String(), policy: Type.Optional(Type.String()) }),
        response: { 200: Type.Any() },
      },
    },
    async (request, reply) => {
      const { executionId, policy } = request.query as { executionId: string; policy?: string };
      const state = await engine.getExecution(executionId);
      if (!state) {
        return reply.send({ ready: false, reason: `Execution ${executionId} not found`, policy: policy ?? 'required-completed' } as never);
      }
      const plan = createOnboardingPlan({ id: state.planId, revision: 1, steps: [] });
      const readyPolicy = createReadyStatePolicy((policy as 'all-completed' | 'required-completed' | 'any-completed') ?? 'required-completed', []);
      const result = readyPolicy.evaluate(state, plan);
      return reply.send({ ...result, policy: readyPolicy.policy } as never);
    },
  );
};
