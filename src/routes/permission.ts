import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { PermissionService } from '../permission/service/permission-service.js';
import type { PermissionRegistry } from '../permission/registry/permission-registry.js';
import type { TemporaryGrantStore } from '../permission/store/temporary-grant-store.js';

const PermissionDefinitionSchema = Type.Object({
  id: Type.String(),
  resource: Type.String(),
  action: Type.String(),
  risk: Type.Union([Type.Literal('low'), Type.Literal('medium'), Type.Literal('high'), Type.Literal('critical')]),
  description: Type.Optional(Type.String()),
});

const DecisionSchema = Type.Object({
  effect: Type.Union([
    Type.Literal('allow'),
    Type.Literal('deny'),
    Type.Literal('approval-required'),
    Type.Literal('constrained'),
  ]),
  permission: Type.String(),
  principalId: Type.String(),
  reason: Type.String(),
  matchedPolicies: Type.Array(Type.String()),
  risk: Type.String(),
});

const EvaluateBodySchema = Type.Object({
  permission: Type.String(),
  principalId: Type.String(),
  scope: Type.Optional(Type.String()),
  resource: Type.Optional(Type.String()),
  approved: Type.Optional(Type.Boolean()),
  temporaryGrantId: Type.Optional(Type.String()),
});

const GrantBodySchema = Type.Object({
  principalId: Type.String(),
  permission: Type.String(),
  scope: Type.Optional(Type.String()),
});

const DelegateBodySchema = Type.Object({
  delegatorId: Type.String(),
  delegateeId: Type.String(),
  permissions: Type.Array(Type.String()),
  scope: Type.Optional(Type.String()),
});

const TempGrantBodySchema = Type.Object({
  principalId: Type.String(),
  permission: Type.String(),
  scope: Type.Optional(Type.String()),
  reason: Type.String(),
  durationSeconds: Type.Integer(),
  maxUses: Type.Optional(Type.Integer()),
  approvedBy: Type.Optional(Type.String()),
});

const RoleSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  permissions: Type.Array(Type.String()),
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
 * PERM-019 — Permission control API. Definitions, roles, evaluation, effective
 * permissions, grants, delegation (bounded), and temporary grants.
 */
export const permissionRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const permission = app.application.container.resolve<PermissionService>('permission');
  const registry = app.application.container.resolve<PermissionRegistry>('permission.registry');
  const grants = app.application.container.resolve<TemporaryGrantStore>('permission.grants');

  app.get(
    '/api/v2/permissions',
    {
      schema: {
        tags: ['permissions'],
        summary: 'List permission definitions',
        response: { 200: Type.Array(PermissionDefinitionSchema) },
      },
    },
    async (_request, reply) =>
      reply.send(
        registry.listDefinitions().map((d) => ({ id: d.id, resource: d.resource, action: d.action, risk: d.risk, ...(d.description !== undefined ? { description: d.description } : {}) })) as never,
      ),
  );

  app.get(
    '/api/v2/permissions/roles',
    {
      schema: {
        tags: ['permissions'],
        summary: 'List permission roles',
        response: { 200: Type.Array(RoleSchema) },
      },
    },
    async (_request, reply) => reply.send(registry.listRoles() as never),
  );

  app.post(
    '/api/v2/permissions/evaluate',
    {
      schema: {
        tags: ['permissions'],
        summary: 'Evaluate a permission request',
        body: EvaluateBodySchema,
        response: { 200: DecisionSchema },
      },
    },
    async (request, reply) => {
      const decision = permission.evaluate(request.body as never);
      return reply.send(decision as never);
    },
  );

  app.get(
    '/api/v2/permissions/effective',
    {
      schema: {
        tags: ['permissions'],
        summary: 'Effective permissions for a principal',
        querystring: Type.Object({ principalId: Type.String(), scope: Type.Optional(Type.String()) }),
        response: { 200: Type.Array(Type.String()) },
      },
    },
    async (request, reply) => reply.send(permission.effectivePermissions(request.query.principalId, request.query.scope) as never),
  );

  app.post(
    '/api/v2/permissions/grants',
    {
      schema: {
        tags: ['permissions'],
        summary: 'Grant a permission to a principal',
        body: GrantBodySchema,
        response: { 201: Type.Object({ granted: Type.Boolean() }) },
      },
    },
    async (request, reply) => {
      permission.grant(request.body.principalId, request.body.permission, request.body.scope);
      return reply.status(201).send({ granted: true } as never);
    },
  );

  app.post(
    '/api/v2/permissions/delegate',
    {
      schema: {
        tags: ['permissions'],
        summary: 'Delegate permissions (bounded by delegator effective permissions)',
        body: DelegateBodySchema,
        response: { 200: Type.Object({ delegated: Type.Array(Type.String()) }) },
      },
    },
    async (request, reply) => {
      const delegated = permission.delegate(request.body.delegatorId, request.body.delegateeId, request.body.permissions, request.body.scope);
      return reply.send({ delegated } as never);
    },
  );

  app.post(
    '/api/v2/permissions/temporary',
    {
      schema: {
        tags: ['permissions'],
        summary: 'Issue a temporary permission grant (lease)',
        body: TempGrantBodySchema,
        response: { 201: Type.Object({ id: Type.String(), permission: Type.String(), principalId: Type.String(), expiresAt: Type.String(), reason: Type.String() }) },
      },
    },
    async (request, reply) => {
      const grant = permission.issueTemporaryGrant(request.body as never);
      return reply.status(201).send(grant as never);
    },
  );

  app.get(
    '/api/v2/permissions/temporary',
    {
      schema: {
        tags: ['permissions'],
        summary: 'List temporary permission grants',
        querystring: Type.Object({ principalId: Type.Optional(Type.String()) }),
        response: {
          200: Type.Array(
            Type.Object({
              id: Type.String(),
              principalId: Type.String(),
              permission: Type.String(),
              reason: Type.String(),
              issuedAt: Type.String(),
              expiresAt: Type.String(),
              uses: Type.Integer(),
            }),
          ),
        },
      },
    },
    async (request, reply) => reply.send(grants.list(request.query.principalId) as never),
  );
};
