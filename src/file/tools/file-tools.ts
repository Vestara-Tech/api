import type { FileService } from '../service/file-service.js';
import type { ToolContribution } from '../../tool/domain/contracts.js';

/**
 * FILE — Agent tools. Agents become File Module clients; they never receive
 * Node's unrestricted `fs`. Reads auto-approve; writes require approval.
 */
export function fileToolContributions(file: FileService): readonly ToolContribution[] {
  return [
    {
      toolId: 'file.read',
      version: '1',
      description: 'Read a file within a mounted workspace',
      inputSchema: {
        type: 'object',
        properties: { workspaceId: { type: 'string' }, path: { type: 'string' } },
        required: ['workspaceId', 'path'],
        additionalProperties: false,
      },
      outputSchema: { type: 'object' },
      capabilities: ['file.read'],
      risk: 'read',
      handler: async (_ctx, input) => {
        const { workspaceId, path } = input as { workspaceId: string; path: string };
        const result = await file.read(workspaceId, path);
        return { content: result.content, resource: result.resource };
      },
    },
    {
      toolId: 'file.list',
      version: '1',
      description: 'List a directory within a mounted workspace',
      inputSchema: {
        type: 'object',
        properties: { workspaceId: { type: 'string' }, path: { type: 'string' } },
        required: ['workspaceId', 'path'],
        additionalProperties: false,
      },
      outputSchema: { type: 'object' },
      capabilities: ['file.list'],
      risk: 'read',
      handler: async (_ctx, input) => {
        const { workspaceId, path } = input as { workspaceId: string; path: string };
        const resources = await file.list(workspaceId, path);
        return resources.map((r) => ({ name: r.name, path: r.path, kind: r.kind }));
      },
    },
    {
      toolId: 'file.search',
      version: '1',
      description: 'Search file names within a mounted workspace',
      inputSchema: {
        type: 'object',
        properties: { workspaceId: { type: 'string' }, pattern: { type: 'string' }, limit: { type: 'number' } },
        required: ['workspaceId', 'pattern'],
        additionalProperties: false,
      },
      outputSchema: { type: 'object' },
      capabilities: ['file.search'],
      risk: 'read',
      handler: async (_ctx, input) => {
        const { workspaceId, pattern, limit } = input as { workspaceId: string; pattern: string; limit?: number };
        return file.search(workspaceId, { pattern, ...(limit !== undefined ? { limit } : {}) });
      },
    },
    {
      toolId: 'file.write',
      version: '1',
      description: 'Write files via a governed transaction (requires approval)',
      inputSchema: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string' },
          operations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                kind: { type: 'string' },
                path: { type: 'string' },
                content: { type: 'string' },
                destination: { type: 'string' },
              },
              required: ['kind', 'path'],
            },
          },
        },
        required: ['workspaceId', 'operations'],
        additionalProperties: false,
      },
      outputSchema: { type: 'object' },
      capabilities: ['file.write'],
      risk: 'write',
      handler: async (_ctx, input) => {
        const { workspaceId, operations } = input as { workspaceId: string; operations: never[] };
        const transaction = file.createTransaction(workspaceId, operations as never);
        const preview = file.previewTransaction(transaction.id);
        return { transactionId: transaction.id, preview: preview.preview };
      },
    },
  ];
}
