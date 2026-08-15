export type ApiDefinitionStatus =
  | 'draft'
  | 'validating'
  | 'ready'
  | 'publishing'
  | 'published'
  | 'superseded';

export type ApiFieldType =
  | 'string'
  | 'text'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'uuid'
  | 'email'
  | 'url'
  | 'date'
  | 'date-time'
  | 'json'
  | 'enum'
  | 'relation';

export interface ApiField {
  readonly id: string;
  readonly name: string;
  readonly type: ApiFieldType;
  readonly required?: boolean;
  readonly unique?: boolean;
  readonly indexed?: boolean;
  readonly items?: ApiFieldType;
  readonly enumValues?: readonly string[];
  readonly default?: unknown;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly format?: string;
  readonly description?: string;
}

export type ApiRelationKind = 'one-to-one' | 'one-to-many' | 'many-to-one' | 'many-to-many';

export interface ApiRelation {
  readonly id: string;
  readonly name: string;
  readonly kind: ApiRelationKind;
  readonly targetResource: string;
  readonly foreignKey?: string;
}

export interface ApiIndex {
  readonly id: string;
  readonly name: string;
  readonly fields: readonly string[];
  readonly unique?: boolean;
}

export interface ApiResource {
  readonly id: string;
  readonly name: string;
  readonly plural?: string;
  readonly description?: string;
  readonly fields: readonly ApiField[];
  readonly relations?: readonly ApiRelation[];
  readonly indexes?: readonly ApiIndex[];
}

export type ApiHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiEndpointParameter {
  readonly id: string;
  readonly name: string;
  readonly in: 'path' | 'query' | 'header' | 'cookie';
  readonly type: ApiFieldType;
  readonly required?: boolean;
  readonly description?: string;
}

export interface ApiEndpointResponse {
  readonly status: number;
  readonly description?: string;
  readonly contentType?: string;
  readonly resource?: string;
}

export interface ApiEndpoint {
  readonly id: string;
  readonly method: ApiHttpMethod;
  readonly path: string;
  readonly operationId?: string;
  readonly summary?: string;
  readonly parameters?: readonly ApiEndpointParameter[];
  readonly requestBody?: {
    readonly contentType?: string;
    readonly resource?: string;
  };
  readonly responses?: readonly ApiEndpointResponse[];
  readonly policyIds?: readonly string[];
  readonly capabilityBinding?: string;
}

export interface ApiPolicy {
  readonly id: string;
  readonly name: string;
  readonly effect: 'allow' | 'deny';
  readonly action: string;
  readonly resource?: string;
  readonly description?: string;
}

export interface ApiOperation {
  readonly id: string;
  readonly name: string;
  readonly kind: string;
  readonly description?: string;
}

export interface ApiEvent {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
}

export interface ApiDefinitionMetadata {
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly author?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ApiDefinition {
  readonly id: string;
  readonly name: string;
  readonly namespace: string;
  readonly version: string;
  readonly status: ApiDefinitionStatus;
  readonly resources: readonly ApiResource[];
  readonly endpoints: readonly ApiEndpoint[];
  readonly policies: readonly ApiPolicy[];
  readonly operations: readonly ApiOperation[];
  readonly events: readonly ApiEvent[];
  readonly revision: number;
  readonly metadata: ApiDefinitionMetadata;
}

export interface CreateApiDefinitionInput {
  readonly name: string;
  readonly namespace: string;
  readonly version: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly author?: string;
}

export interface ApiDefinitionRevision {
  readonly definition: ApiDefinition;
  readonly compiledHash: string;
  readonly recordedAt: string;
}

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
}
