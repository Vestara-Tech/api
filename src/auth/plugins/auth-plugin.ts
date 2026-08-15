import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { unauthorized } from '../../core/errors.js';
import type { AuthenticationContext } from '../domain/identity.js';
import type { AuthenticationService } from '../service/authentication-service.js';
import type { IdentityStore } from '../store/identity-store.js';
import type { RequestContext } from '../../core/context.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Resolved authentication context for the request (undefined = anonymous). */
    authContext?: AuthenticationContext;
  }
}

export interface RegisterAuthPluginOptions {
  readonly authentication: AuthenticationService;
  readonly identities: IdentityStore;
}

export function registerAuthPlugin(app: FastifyInstance, options: RegisterAuthPluginOptions): void {
  app.decorateRequest('authContext', undefined);

  app.addHook('onRequest', async (request) => {
    const token = bearerToken(request);
    if (token === null) return;

    const session = await options.authentication.validateSessionToken(token);
    if (!session) return;

    const identity = await options.identities.get(session.identityId);
    if (!identity || identity.status !== 'active') return;

    const correlation = request.ctx ? { requestId: request.ctx.requestId, correlationId: request.ctx.correlationId } : {};
    request.authContext = {
      principal: {
        kind: identity.principalKind,
        identityId: identity.id,
        ...(identity.profile.displayName !== undefined ? { displayName: identity.profile.displayName } : {}),
      },
      sessionId: session.id,
      authenticationMethod: session.authenticationMethod,
      scopes: [],
      roles: identity.roles,
      permissions: identity.permissions,
      assurance: assuranceValue(session.assuranceLevel),
      correlation,
    };
  });
}

/** Fastify onRequest helper that rejects anonymous requests. */
export function requireAuth(request: FastifyRequest, _reply: FastifyReply): void {
  if (!request.authContext) {
    throw unauthorized('Authentication required');
  }
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1]! : null;
}

function assuranceValue(level: string): number {
  switch (level) {
    case 'high':
      return 3;
    case 'medium':
      return 2;
    case 'low':
      return 1;
    default:
      return 0;
  }
}
