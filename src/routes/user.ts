import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { UserService } from '../user/service/user-service.js';

const UserSchema = Type.Object({
  id: Type.String(),
  identityId: Type.String(),
  username: Type.String(),
  status: Type.String(),
  profile: Type.Object({ displayName: Type.String(), avatar: Type.Optional(Type.String()), locale: Type.Optional(Type.String()), timezone: Type.Optional(Type.String()), jobTitle: Type.Optional(Type.String()), organization: Type.Optional(Type.String()) }),
  preferences: Type.Record(Type.String(), Type.Any()),
  settings: Type.Object({ emailVerified: Type.Boolean(), email: Type.Optional(Type.String()), twoFactorEnabled: Type.Boolean() }),
  memberships: Type.Array(Type.Object({ id: Type.String(), organizationId: Type.String(), workspaceId: Type.Optional(Type.String()), roleIds: Type.Array(Type.String()) })),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  deletedAt: Type.Optional(Type.String()),
});

const CreateUserBodySchema = Type.Object({
  identityId: Type.String(),
  username: Type.String(),
  status: Type.Optional(Type.String()),
  profile: Type.Object({ displayName: Type.String(), avatar: Type.Optional(Type.String()), locale: Type.Optional(Type.String()), timezone: Type.Optional(Type.String()), jobTitle: Type.Optional(Type.String()), organization: Type.Optional(Type.String()) }),
  preferences: Type.Optional(Type.Record(Type.String(), Type.Any())),
  settings: Type.Optional(Type.Object({ emailVerified: Type.Optional(Type.Boolean()), email: Type.Optional(Type.String()), twoFactorEnabled: Type.Optional(Type.Boolean()) })),
  memberships: Type.Optional(Type.Array(Type.Object({ id: Type.String(), organizationId: Type.String(), workspaceId: Type.Optional(Type.String()), roleIds: Type.Array(Type.String()) }))),
});

/**
 * USR-030 — User control API. Human account/profile layer. Authentication
 * owns credentials; Permission owns authorization; this module owns the
 * human-facing account.
 */
export const userRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const users = app.application.container.resolve<UserService>('users');

  app.get(
    '/api/v2/users',
    {
      schema: {
        tags: ['users'],
        summary: 'List users',
        response: { 200: Type.Array(UserSchema) },
      },
    },
    async (_request, reply) => reply.send(users.list() as never),
  );

  app.post(
    '/api/v2/users',
    {
      schema: {
        tags: ['users'],
        summary: 'Provision a user (linked to an identity)',
        body: CreateUserBodySchema,
        response: { 201: UserSchema },
      },
    },
    async (request, reply) => reply.status(201).send(users.create(request.body as never) as never),
  );

  app.get(
    '/api/v2/users/:id',
    {
      schema: {
        tags: ['users'],
        summary: 'Get a user',
        params: Type.Object({ id: Type.String() }),
        response: { 200: UserSchema },
      },
    },
    async (request, reply) => reply.send(users.get(request.params.id) as never),
  );

  app.get(
    '/api/v2/users/by-identity/:identityId',
    {
      schema: {
        tags: ['users'],
        summary: 'Resolve a user by identity',
        params: Type.Object({ identityId: Type.String() }),
        response: {
          200: UserSchema,
          404: Type.Object({ error: Type.Object({ code: Type.String(), message: Type.String() }) }),
        },
      },
    },
    async (request, reply) => {
      const user = users.getByIdentity(request.params.identityId);
      if (!user) return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'No user for identity' } } as never);
      return reply.send(user as never);
    },
  );

  app.patch(
    '/api/v2/users/:id/status',
    {
      schema: {
        tags: ['users'],
        summary: 'Transition user lifecycle (active/suspended/disabled/deleted)',
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({ to: Type.String() }),
        response: { 200: UserSchema },
      },
    },
    async (request, reply) => reply.send(users.transition(request.params.id, request.body.to as never) as never),
  );

  app.patch(
    '/api/v2/users/:id/profile',
    {
      schema: {
        tags: ['users'],
        summary: 'Update user profile',
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({ displayName: Type.String(), avatar: Type.Optional(Type.String()), locale: Type.Optional(Type.String()), timezone: Type.Optional(Type.String()), jobTitle: Type.Optional(Type.String()), organization: Type.Optional(Type.String()) }),
        response: { 200: UserSchema },
      },
    },
    async (request, reply) => reply.send(users.updateProfile(request.params.id, request.body as never) as never),
  );

  app.patch(
    '/api/v2/users/:id/preferences',
    {
      schema: {
        tags: ['users'],
        summary: 'Update namespaced user preferences',
        params: Type.Object({ id: Type.String() }),
        body: Type.Record(Type.String(), Type.Any()),
        response: { 200: UserSchema },
      },
    },
    async (request, reply) => reply.send(users.updatePreferences(request.params.id, request.body as never) as never),
  );

  app.post(
    '/api/v2/users/:id/memberships',
    {
      schema: {
        tags: ['users'],
        summary: 'Add a membership',
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({ id: Type.String(), organizationId: Type.String(), workspaceId: Type.Optional(Type.String()), roleIds: Type.Array(Type.String()) }),
        response: { 200: UserSchema },
      },
    },
    async (request, reply) => reply.send(users.addMembership(request.params.id, request.body as never) as never),
  );

  app.delete(
    '/api/v2/users/:id/memberships/:membershipId',
    {
      schema: {
        tags: ['users'],
        summary: 'Remove a membership',
        params: Type.Object({ id: Type.String(), membershipId: Type.String() }),
        response: { 200: UserSchema },
      },
    },
    async (request, reply) => reply.send(users.removeMembership(request.params.id, request.params.membershipId) as never),
  );
};
