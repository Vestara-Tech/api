import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { requireAuth } from '../auth/plugins/auth-plugin.js';
import type { AuthenticationService } from '../auth/service/authentication-service.js';
import type { IdentityService } from '../auth/service/identity-service.js';
import type { AuthorizationService } from '../auth/service/authorization-service.js';
import type { IdentityStore } from '../auth/store/identity-store.js';

const ErrorSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    requestId: Type.String(),
    correlationId: Type.String(),
    retryable: Type.Boolean(),
    details: Type.Optional(Type.Any()),
  }),
});

const IdentitySchema = Type.Object({
  id: Type.String(),
  principalKind: Type.String(),
  status: Type.String(),
  profile: Type.Object({
    displayName: Type.Optional(Type.String()),
    primaryEmail: Type.Optional(Type.String()),
    pictureUrl: Type.Optional(Type.String()),
  }),
  roles: Type.Array(Type.String()),
  permissions: Type.Array(Type.String()),
});

const SessionSchema = Type.Object({
  id: Type.String(),
  identityId: Type.String(),
  principalKind: Type.String(),
  authenticationMethod: Type.String(),
  authenticationTime: Type.String(),
  assuranceLevel: Type.String(),
  device: Type.Optional(Type.String()),
  expiresAt: Type.String(),
  lastSeenAt: Type.String(),
  revokedAt: Type.Optional(Type.String()),
});

export const authRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const authentication = app.application.container.resolve<AuthenticationService>('auth.authentication');
  const identities = app.application.container.resolve<IdentityService>('auth.identities');
  const identityStore = app.application.container.resolve<IdentityStore>('auth.identityStore');
  const authorization = app.application.container.resolve<AuthorizationService>('auth.authorization');

  app.post(
    '/api/v2/auth/login',
    {
      schema: {
        tags: ['auth'],
        summary: 'Authenticate with a password credential',
        body: Type.Object({
          identityId: Type.String(),
          password: Type.String(),
          device: Type.Optional(Type.String()),
        }),
        response: {
          200: Type.Object({
            token: Type.String(),
            session: SessionSchema,
            identity: IdentitySchema,
          }),
          401: ErrorSchema,
        },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const result = await authentication.loginWithPassword(body.identityId, body.password, body.device);
      return reply.send({ token: result.token, session: result.session, identity: result.identity } as never);
    },
  );

  app.post(
    '/api/v2/auth/logout',
    {
      schema: {
        tags: ['auth'],
        summary: 'Revoke the current session',
        headers: Type.Object({ authorization: Type.Optional(Type.String()) }),
        response: { 204: Type.Null() },
      },
    },
    async (request, reply) => {
      const sessionId = request.authContext?.sessionId;
      if (sessionId !== undefined) await authentication.revokeSession(sessionId);
      return reply.status(204).send(null);
    },
  );

  app.get(
    '/api/v2/auth/me',
    {
      schema: {
        tags: ['auth'],
        summary: 'Current identity (requires Bearer token)',
        response: { 200: IdentitySchema, 401: ErrorSchema },
      },
    },
    async (request, reply) => {
      requireAuth(request, reply);
      const identity = await identities.get(request.authContext!.principal.identityId);
      return reply.send(identity as never);
    },
  );

  app.get(
    '/api/v2/auth/sessions',
    {
      schema: {
        tags: ['auth'],
        summary: 'Active sessions for the current identity',
        response: { 200: Type.Array(SessionSchema), 401: ErrorSchema },
      },
    },
    async (request, reply) => {
      requireAuth(request, reply);
      const sessions = await authentication.listSessions(request.authContext!.principal.identityId);
      return reply.send(sessions as never);
    },
  );

  app.post(
    '/api/v2/auth/sessions/:sessionId/revoke',
    {
      schema: {
        tags: ['auth'],
        summary: 'Revoke a session',
        params: Type.Object({ sessionId: Type.String() }),
        response: { 204: Type.Null(), 401: ErrorSchema },
      },
    },
    async (request, reply) => {
      requireAuth(request, reply);
      await authentication.revokeSession(request.params.sessionId);
      return reply.status(204).send(null);
    },
  );

  app.post(
    '/api/v2/auth/check',
    {
      schema: {
        tags: ['auth'],
        summary: 'Check a permission against the current identity (AUTH-005)',
        body: Type.Object({ permission: Type.String(), resource: Type.Optional(Type.String()) }),
        headers: Type.Object({ authorization: Type.Optional(Type.String()) }),
        response: {
          200: Type.Object({ allowed: Type.Boolean(), requiredApproval: Type.Optional(Type.Boolean()), reason: Type.Optional(Type.String()) }),
          401: ErrorSchema,
        },
      },
    },
    async (request, reply) => {
      requireAuth(request, reply);
      const decision = authorization.authorize(request.authContext!, request.body.permission, request.body.resource);
      return reply.send({
        allowed: decision.allowed,
        ...(decision.requiredApproval !== undefined ? { requiredApproval: decision.requiredApproval } : {}),
        ...(decision.reason !== undefined ? { reason: decision.reason } : {}),
      });
    },
  );
};
