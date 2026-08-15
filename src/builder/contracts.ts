import { Type, type Static } from '@sinclair/typebox';

export const ApiFieldSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  type: Type.String(),
  required: Type.Optional(Type.Boolean()),
  unique: Type.Optional(Type.Boolean()),
  indexed: Type.Optional(Type.Boolean()),
  enumValues: Type.Optional(Type.Array(Type.String())),
});

export const ApiRelationSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  kind: Type.Union([Type.Literal('one-to-one'), Type.Literal('one-to-many'), Type.Literal('many-to-one'), Type.Literal('many-to-many')]),
  targetResource: Type.String(),
  foreignKey: Type.Optional(Type.String()),
});

export const ApiIndexSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  fields: Type.Array(Type.String()),
  unique: Type.Optional(Type.Boolean()),
});

export const ApiResourceSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  plural: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  fields: Type.Array(ApiFieldSchema),
  relations: Type.Optional(Type.Array(ApiRelationSchema)),
  indexes: Type.Optional(Type.Array(ApiIndexSchema)),
});

export const ApiEndpointParameterSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  in: Type.Union([Type.Literal('path'), Type.Literal('query'), Type.Literal('header'), Type.Literal('cookie')]),
  type: Type.String(),
  required: Type.Optional(Type.Boolean()),
});

export const ApiEndpointResponseSchema = Type.Object({
  status: Type.Integer(),
  description: Type.Optional(Type.String()),
  resource: Type.Optional(Type.String()),
});

export const ApiEndpointSchema = Type.Object({
  id: Type.String(),
  method: Type.Union([Type.Literal('GET'), Type.Literal('POST'), Type.Literal('PUT'), Type.Literal('PATCH'), Type.Literal('DELETE')]),
  path: Type.String(),
  summary: Type.Optional(Type.String()),
  parameters: Type.Optional(Type.Array(ApiEndpointParameterSchema)),
  requestBody: Type.Optional(Type.Object({ resource: Type.Optional(Type.String()) })),
  responses: Type.Optional(Type.Array(ApiEndpointResponseSchema)),
  policyIds: Type.Optional(Type.Array(Type.String())),
  capabilityBinding: Type.Optional(Type.String()),
});

export const ApiPolicySchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  effect: Type.Union([Type.Literal('allow'), Type.Literal('deny')]),
  action: Type.String(),
  resource: Type.Optional(Type.String()),
});

export const ApiOperationSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  kind: Type.String(),
});

export const ApiEventSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
});

export const ApiDefinitionSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  namespace: Type.String(),
  version: Type.String(),
  status: Type.String(),
  resources: Type.Array(ApiResourceSchema),
  endpoints: Type.Array(ApiEndpointSchema),
  policies: Type.Array(ApiPolicySchema),
  operations: Type.Array(ApiOperationSchema),
  events: Type.Array(ApiEventSchema),
  revision: Type.Integer(),
  metadata: Type.Object({
    description: Type.Optional(Type.String()),
    tags: Type.Optional(Type.Array(Type.String())),
    author: Type.Optional(Type.String()),
    createdAt: Type.String(),
    updatedAt: Type.String(),
  }),
});

export const CreateDefinitionBody = Type.Object({
  name: Type.String(),
  namespace: Type.String(),
  version: Type.String(),
  description: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  author: Type.Optional(Type.String()),
});

export const UpdateDefinitionBody = Type.Object({
  name: Type.Optional(Type.String()),
  namespace: Type.Optional(Type.String()),
  version: Type.Optional(Type.String()),
  resources: Type.Optional(Type.Array(ApiResourceSchema)),
  endpoints: Type.Optional(Type.Array(ApiEndpointSchema)),
  policies: Type.Optional(Type.Array(ApiPolicySchema)),
  operations: Type.Optional(Type.Array(ApiOperationSchema)),
  events: Type.Optional(Type.Array(ApiEventSchema)),
});

export const ValidationResultSchema = Type.Object({
  ok: Type.Boolean(),
  issues: Type.Array(
    Type.Object({
      path: Type.String(),
      message: Type.String(),
      severity: Type.Union([Type.Literal('error'), Type.Literal('warning')]),
    }),
  ),
});

export const ContractSchema = Type.Object({
  hash: Type.String(),
  compilerVersion: Type.String(),
  openapi: Type.Any(),
  routes: Type.Array(Type.Any()),
});

export const CompatibilityChangeSchema = Type.Object({
  kind: Type.String(),
  path: Type.String(),
  severity: Type.Union([Type.Literal('breaking'), Type.Literal('compatible'), Type.Literal('info')]),
  message: Type.String(),
});

export const CompatibilitySchema = Type.Object({
  classification: Type.Union([Type.Literal('compatible'), Type.Literal('breaking'), Type.Literal('unknown')]),
  changes: Type.Array(CompatibilityChangeSchema),
});

export const PreviewResultSchema = Type.Object({
  definition: ApiDefinitionSchema,
  validation: ValidationResultSchema,
  contract: ContractSchema,
  compatibility: CompatibilitySchema,
  publishable: Type.Boolean(),
});

export const RevisionSchema = Type.Object({
  definition: ApiDefinitionSchema,
  compiledHash: Type.String(),
  recordedAt: Type.String(),
});

export const ListQuerySchema = Type.Object({
  cursor: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Union([Type.Integer(), Type.String()])),
  status: Type.Optional(Type.String()),
  search: Type.Optional(Type.String()),
  sort: Type.Optional(Type.String()),
});

export const ListDefinitionsResultSchema = Type.Object({
  items: Type.Array(ApiDefinitionSchema),
  nextCursor: Type.Union([Type.String(), Type.Null()]),
  total: Type.Integer(),
});

export const PublishResultSchema = Type.Object({
  definition: ApiDefinitionSchema,
  operationId: Type.String(),
});

export const ErrorSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    requestId: Type.String(),
    correlationId: Type.String(),
    retryable: Type.Boolean(),
    details: Type.Optional(Type.Any()),
  }),
});

export type ApiFieldContract = Static<typeof ApiFieldSchema>;
export type ApiRelationContract = Static<typeof ApiRelationSchema>;
export type ApiIndexContract = Static<typeof ApiIndexSchema>;
export type ApiResourceContract = Static<typeof ApiResourceSchema>;
export type ApiEndpointParameterContract = Static<typeof ApiEndpointParameterSchema>;
export type ApiEndpointResponseContract = Static<typeof ApiEndpointResponseSchema>;
export type ApiEndpointContract = Static<typeof ApiEndpointSchema>;
export type ApiPolicyContract = Static<typeof ApiPolicySchema>;
export type ApiOperationContract = Static<typeof ApiOperationSchema>;
export type ApiEventContract = Static<typeof ApiEventSchema>;
export type ApiDefinitionContract = Static<typeof ApiDefinitionSchema>;
export type CreateDefinitionBodyContract = Static<typeof CreateDefinitionBody>;
export type UpdateDefinitionBodyContract = Static<typeof UpdateDefinitionBody>;
export type ValidationResultContract = Static<typeof ValidationResultSchema>;
export type ContractContract = Static<typeof ContractSchema>;
export type CompatibilityChangeContract = Static<typeof CompatibilityChangeSchema>;
export type CompatibilityContract = Static<typeof CompatibilitySchema>;
export type PreviewResultContract = Static<typeof PreviewResultSchema>;
export type RevisionContract = Static<typeof RevisionSchema>;
export type ListDefinitionsResultContract = Static<typeof ListDefinitionsResultSchema>;
export type PublishResultContract = Static<typeof PublishResultSchema>;
