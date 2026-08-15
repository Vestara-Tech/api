import type { ApiDefinition } from '../../src/builder/domain/types.js';

export function makeProductDefinition(overrides?: Partial<ApiDefinition>): ApiDefinition {
  return {
    id: 'api_prod123',
    name: 'Products API',
    namespace: 'catalog',
    version: '1.0.0',
    status: 'draft',
    resources: [
      {
        id: 'res_user',
        name: 'Product',
        plural: 'products',
        fields: [
          { id: 'f1', name: 'id', type: 'uuid', required: true, unique: true },
          { id: 'f2', name: 'name', type: 'string', required: true },
          { id: 'f3', name: 'sku', type: 'string', unique: true },
          { id: 'f4', name: 'price', type: 'number', required: true },
        ],
      },
    ],
    endpoints: [
      {
        id: 'ep1',
        method: 'GET',
        path: '/products',
        summary: 'List products',
        responses: [{ status: 200, resource: 'Product' }],
      },
      {
        id: 'ep2',
        method: 'POST',
        path: '/products',
        summary: 'Create product',
        requestBody: { resource: 'Product' },
        responses: [{ status: 201, resource: 'Product' }],
      },
    ],
    policies: [{ id: 'pol_read', name: 'read-products', effect: 'allow', action: 'read' }],
    operations: [],
    events: [],
    revision: 0,
    metadata: { createdAt: '2026-08-15T00:00:00.000Z', updatedAt: '2026-08-15T00:00:00.000Z' },
    ...overrides,
  };
}
