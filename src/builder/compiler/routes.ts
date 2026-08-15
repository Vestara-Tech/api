import type { ApiDefinition } from '../domain/types.js';

export interface CompiledRouteDefinition {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  readonly path: string;
  readonly operationId: string;
  readonly resource?: string;
  readonly policyIds: readonly string[];
  readonly capabilityBinding?: string;
}

export function compileRouteDefinitions(definition: ApiDefinition): readonly CompiledRouteDefinition[] {
  return definition.endpoints.map((endpoint) => {
    const resource = endpoint.requestBody?.resource ?? endpoint.responses?.find((r) => r.resource)?.resource;
    return {
      method: endpoint.method,
      path: endpoint.path,
      operationId: endpoint.operationId ?? `${endpoint.method.toLowerCase()}${endpoint.path.replace(/[^a-zA-Z0-9]/g, '-')}`,
      ...(resource !== undefined ? { resource } : {}),
      policyIds: endpoint.policyIds ?? [],
      ...(endpoint.capabilityBinding !== undefined ? { capabilityBinding: endpoint.capabilityBinding } : {}),
    };
  });
}
