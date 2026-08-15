import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { LoginBroker } from '../login/service/login-broker.js';
import { isPreAuthAllowed } from '../login/domain/preauth.js';

const ErrorSchema = Type.Object({ error: Type.Object({ code: Type.String(), message: Type.String(), requestId: Type.String(), correlationId: Type.String(), retryable: Type.Boolean(), details: Type.Optional(Type.Any()) }) });

export const loginRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const broker = app.application.container.resolve<LoginBroker>('loginBroker');

  app.get(
    '/api/v2/login/capabilities',
    {
      schema: {
        tags: ['login'],
        summary: 'Login capability discovery (UI renders only supported methods)',
        response: { 200: Type.Object({ password: Type.Boolean(), fingerprint: Type.Boolean(), fido2: Type.Boolean(), smartCard: Type.Boolean(), passkey: Type.Boolean(), recovery: Type.Boolean() }) },
      },
    },
    async () => broker.capabilities(),
  );

  app.get(
    '/api/v2/login/users',
    {
      schema: {
        tags: ['login'],
        summary: 'List selectable OS users',
        response: { 200: Type.Array(Type.Object({ userId: Type.String(), displayName: Type.String(), avatarUrl: Type.Optional(Type.String()) })) },
      },
    },
    async (_request, reply) => reply.send((await broker.listUsers()) as never),
  );

  app.post(
    '/api/v2/login/authenticate',
    {
      schema: {
        tags: ['login'],
        summary: 'Authenticate an OS login (broker delegates to OS/PAM adapter; UI never validates)',
        body: Type.Object({ userId: Type.String(), method: Type.String(), secret: Type.Optional(Type.String()) }),
        response: { 200: Type.Any(), 401: ErrorSchema },
      },
    },
    async (request, reply) => {
      const result = await broker.authenticate({
        userId: request.body.userId,
        method: request.body.method as 'password' | 'fido2' | 'fingerprint' | 'smartcard' | 'passkey' | 'recovery',
        ...(request.body.secret !== undefined ? { secret: request.body.secret } : {}),
      });
      if (result.status === 'denied') {
        return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: `Login denied: ${result.reason}`, requestId: request.ctx.requestId, correlationId: request.ctx.correlationId, retryable: false } });
      }
      return reply.send(result);
    },
  );

  app.post(
    '/api/v2/login/preauth/check',
    {
      schema: {
        tags: ['login'],
        summary: 'Check whether a capability is allowed pre-auth (greeter boundary)',
        body: Type.Object({ capability: Type.String() }),
        response: { 200: Type.Object({ allowed: Type.Boolean() }) },
      },
    },
    async (request) => ({ allowed: isPreAuthAllowed(request.body.capability) }),
  );
};
