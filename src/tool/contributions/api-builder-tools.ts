import type { ApiDefinitionService } from '../../builder/service/api-definition-service.js';
import type { ToolContribution, ToolRisk } from '../domain/contracts.js';

/**
 * TOOL-004 — Capability bridge. The API Builder module contributes its
 * capabilities as tools so an API-specialist agent receives tools instead of
 * importing ApiDefinitionService.
 */
export function apiBuilderToolContributions(builder: ApiDefinitionService): readonly ToolContribution[] {
  const contributions: ToolContribution[] = [
    {
      toolId: 'api.definition.read',
      version: '1',
      description: 'List API definitions',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      outputSchema: { type: 'object' },
      capabilities: ['builder.definition.read'],
      risk: 'read',
      handler: async () => builder.list({}),
    },
    {
      toolId: 'api.definition.get',
      version: '1',
      description: 'Get an API definition by id',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
      outputSchema: { type: 'object' },
      capabilities: ['builder.definition.read'],
      risk: 'read',
      handler: async (_ctx, input) => {
        const { id } = input as { id: string };
        return builder.get(id);
      },
    },
    {
      toolId: 'api.definition.validate',
      version: '1',
      description: 'Validate an API definition',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
      outputSchema: { type: 'object' },
      capabilities: ['builder.definition.validate'],
      risk: 'write',
      handler: async (_ctx, input) => {
        const { id } = input as { id: string };
        return builder.validate(id);
      },
    },
    {
      toolId: 'api.definition.preview',
      version: '1',
      description: 'Preview an API definition (contract + compatibility)',
      inputSchema: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
      outputSchema: { type: 'object' },
      capabilities: ['builder.definition.preview'],
      risk: 'read',
      handler: async (_ctx, input) => {
        const { id } = input as { id: string };
        return builder.preview(id);
      },
    },
    {
      toolId: 'api.definition.create',
      version: '1',
      description: 'Create an API definition draft',
      inputSchema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          namespace: { type: 'string' },
          version: { type: 'string' },
        },
        required: ['name', 'namespace', 'version'],
        additionalProperties: false,
      },
      outputSchema: { type: 'object' },
      capabilities: ['builder.definition.create'],
      risk: 'write',
      handler: async (_ctx, input) => {
        const { name, namespace, version } = input as { name: string; namespace: string; version: string };
        return builder.create({ name, namespace, version });
      },
    },
  ];
  return contributions;
}

export function riskOfTool(toolId: string): ToolRisk {
  if (toolId.includes('publish') || toolId.includes('apply')) return 'control';
  if (toolId.includes('delete') || toolId.includes('remove')) return 'control';
  if (toolId.includes('update') || toolId.includes('create') || toolId.includes('validate')) return 'write';
  return 'read';
}
