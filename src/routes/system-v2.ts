import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { SystemV2Service } from '../system/service/system-v2-service.js';
import type { SystemOperationKind } from '../system/service/system-operations.js';

const ServiceSchema = Type.Object({
  name: Type.String(),
  status: Type.String(),
  description: Type.Optional(Type.String()),
  enabled: Type.Optional(Type.Boolean()),
  pid: Type.Optional(Type.Integer()),
});

const JournalEntrySchema = Type.Object({
  id: Type.String(),
  kind: Type.String(),
  risk: Type.String(),
  target: Type.String(),
  status: Type.String(),
  requestedBy: Type.String(),
  requestedAt: Type.String(),
  approvedAt: Type.Optional(Type.String()),
  completedAt: Type.Optional(Type.String()),
  error: Type.Optional(Type.String()),
  approvedBy: Type.Optional(Type.String()),
});

const SnapshotSchema = Type.Object({
  identity: Type.Object({ hostname: Type.String() }),
  operatingSystem: Type.Object({ id: Type.String(), name: Type.String(), version: Type.String(), kernel: Type.String(), architecture: Type.String(), bootMode: Type.String() }),
  firmware: Type.Object({ mode: Type.String() }),
  cpu: Type.Object({ logicalCores: Type.Integer(), status: Type.String() }),
  memory: Type.Object({ totalBytes: Type.Integer(), status: Type.String() }),
  storage: Type.Object({ devices: Type.Array(Type.Object({ name: Type.String(), sizeBytes: Type.Integer() })), totalBytes: Type.Integer(), status: Type.String() }),
  filesystems: Type.Object({ filesystems: Type.Array(Type.Any()), status: Type.String() }),
  network: Type.Object({ interfaces: Type.Array(Type.Object({ name: Type.String(), up: Type.Boolean() })), status: Type.String() }),
  graphics: Type.Object({ devices: Type.Array(Type.Any()), status: Type.String() }),
  devices: Type.Object({ devices: Type.Array(Type.Any()), status: Type.String() }),
  power: Type.Object({ info: Type.Any(), status: Type.String() }),
  thermal: Type.Object({ info: Type.Any(), status: Type.String() }),
  kernel: Type.Object({ release: Type.String(), modules: Type.Array(Type.Any()), status: Type.String() }),
  boot: Type.Object({ entries: Type.Array(Type.Any()), status: Type.String() }),
  capturedAt: Type.String(),
});

/**
 * SYS — System Module V2 control API. Inventory, runtime, storage and the
 * privileged operation journal. Mutations go through typed operations with
 * approval; arbitrary root operations are never expressible.
 */
export const systemV2Routes: FastifyPluginAsyncTypebox = async (app) => {
  const system = app.application.container.resolve<SystemV2Service>('system.v2');

  app.get(
    '/api/v2/system/snapshot',
    {
      schema: {
        tags: ['system'],
        summary: 'Captured system inventory (SystemSnapshot)',
        response: { 200: SnapshotSchema },
      },
    },
    async (_request, reply) => reply.send((await system.snapshot()) as never),
  );

  app.get(
    '/api/v2/system/services',
    {
      schema: {
        tags: ['system'],
        summary: 'List systemd services',
        response: { 200: Type.Array(ServiceSchema) },
      },
    },
    async (_request, reply) => reply.send((await system.services()) as never),
  );

  app.get(
    '/api/v2/system/processes',
    {
      schema: {
        tags: ['system'],
        summary: 'List processes',
        response: { 200: Type.Array(Type.Object({ pid: Type.Integer(), name: Type.String(), memoryBytes: Type.Optional(Type.Integer()) })) },
      },
    },
    async (_request, reply) => reply.send((await system.processes()) as never),
  );

  app.get(
    '/api/v2/system/kernel',
    {
      schema: {
        tags: ['system'],
        summary: 'Kernel release and loaded modules',
        response: { 200: Type.Object({ release: Type.String(), modules: Type.Array(Type.Object({ name: Type.String(), status: Type.String() })), status: Type.String() }) },
      },
    },
    async (_request, reply) => {
      const kernel = system.kernel();
      return reply.send({ release: kernel.release, modules: kernel.modules, status: kernel.status } as never);
    },
  );

  app.get(
    '/api/v2/system/storage',
    {
      schema: {
        tags: ['system'],
        summary: 'Storage disks and mounts (read-only)',
        response: { 200: Type.Object({ disks: Type.Array(Type.Object({ name: Type.String(), sizeBytes: Type.Integer(), type: Type.Optional(Type.String()) })), mounts: Type.Array(Type.Object({ device: Type.String(), mountPoint: Type.String(), filesystem: Type.String(), readOnly: Type.Boolean() })) }) },
      },
    },
    async (_request, reply) => reply.send({ disks: await system.storageDisks(), mounts: await system.storageMounts() } as never),
  );

  // ── Privileged operations (SYS-052..056) ─────────────────────
  app.post(
    '/api/v2/system/operations',
    {
      schema: {
        tags: ['system'],
        summary: 'Request a typed privileged operation (goes to the journal for approval)',
        body: Type.Object({ kind: Type.String(), target: Type.String(), requestedBy: Type.String(), payload: Type.Optional(Type.Record(Type.String(), Type.Any())) }),
        response: { 201: JournalEntrySchema },
      },
    },
    async (request, reply) => reply.status(201).send(system.requestOperation(request.body.kind as SystemOperationKind, request.body.target, request.body.requestedBy, request.body.payload) as never),
  );

  app.post(
    '/api/v2/system/operations/:id/approve',
    {
      schema: {
        tags: ['system'],
        summary: 'Approve a pending operation',
        params: Type.Object({ id: Type.String() }),
        body: Type.Object({ approvedBy: Type.String() }),
        response: { 200: JournalEntrySchema },
      },
    },
    async (request, reply) => reply.send(system.approveOperation(request.params.id, request.body.approvedBy) as never),
  );

  app.post(
    '/api/v2/system/operations/:id/execute',
    {
      schema: {
        tags: ['system'],
        summary: 'Execute an approved operation via the privileged daemon',
        params: Type.Object({ id: Type.String() }),
        response: { 200: JournalEntrySchema },
      },
    },
    async (request, reply) => reply.send((await system.executeOperation(request.params.id)) as never),
  );

  app.get(
    '/api/v2/system/operations',
    {
      schema: {
        tags: ['system'],
        summary: 'Operation journal',
        response: { 200: Type.Array(JournalEntrySchema) },
      },
    },
    async (_request, reply) => reply.send(system.journal() as never),
  );

  app.get(
    '/api/v2/system/operations/:id',
    {
      schema: {
        tags: ['system'],
        summary: 'Get an operation journal entry',
        params: Type.Object({ id: Type.String() }),
        response: { 200: JournalEntrySchema },
      },
    },
    async (request, reply) => reply.send(system.operation(request.params.id) as never),
  );
};
