import type { ApiDefinition, ApiResource } from '../domain/types.js';
import { fieldSchema } from './typebox.js';

export function compileOpenApi(definition: ApiDefinition): Record<string, unknown> {
  const schemas: Record<string, unknown> = {};
  for (const resource of definition.resources) {
    schemas[resource.name] = resourceSchema(resource);
  }

  const paths: Record<string, unknown> = {};
  for (const endpoint of definition.endpoints) {
    const existing = paths[endpoint.path] as Record<string, unknown> | undefined;
    const pathItem = existing ?? {};
    pathItem[endpoint.method.toLowerCase()] = endpointOperation(endpoint);
    paths[endpoint.path] = pathItem;
  }

  return {
    openapi: '3.1.0',
    info: {
      title: definition.name,
      version: definition.version,
      description: definition.metadata.description,
    },
    paths,
    components: { schemas },
  };
}

function resourceSchema(resource: ApiResource): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const field of resource.fields) {
    properties[field.name] = fieldSchema(field);
    if (field.required) required.push(field.name);
  }
  const schema: Record<string, unknown> = {
    type: 'object',
    properties,
    additionalProperties: false,
  };
  if (required.length > 0) schema.required = required;
  return schema;
}

function endpointOperation(endpoint: ApiDefinition['endpoints'][number]): Record<string, unknown> {
  const operation: Record<string, unknown> = {
    operationId: endpoint.operationId ?? `${endpoint.method.toLowerCase()}${endpoint.path.replace(/[^a-zA-Z0-9]/g, '-')}`,
    summary: endpoint.summary,
    parameters: endpoint.parameters?.map((p) => ({
      name: p.name,
      in: p.in,
      required: p.required,
      description: p.description,
      schema: { type: p.type },
    })),
  };

  if (endpoint.requestBody?.resource) {
    operation.requestBody = {
      content: {
        [endpoint.requestBody.contentType ?? 'application/json']: {
          schema: { $ref: `#/components/schemas/${endpoint.requestBody.resource}` },
        },
      },
    };
  }

  const responses: Record<string, unknown> = {};
  for (const response of endpoint.responses ?? []) {
    const content: Record<string, unknown> = {};
    if (response.resource) {
      content[response.contentType ?? 'application/json'] = {
        schema: { $ref: `#/components/schemas/${response.resource}` },
      };
    }
    responses[String(response.status)] = {
      description: response.description ?? '',
      ...(Object.keys(content).length > 0 ? { content } : {}),
    };
  }
  if (!('200' in responses)) responses['200'] = { description: 'OK' };
  operation.responses = responses;
  return operation;
}
