import type { ApiDefinition, ApiEndpoint, ApiField, ApiResource } from '../api/contracts';

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

export const FIELD_TYPES: readonly { value: ApiFieldType; label: string }[] = [
  { value: 'string', label: 'String' },
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'integer', label: 'Integer' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'uuid', label: 'UUID' },
  { value: 'email', label: 'Email' },
  { value: 'url', label: 'URL' },
  { value: 'date', label: 'Date' },
  { value: 'date-time', label: 'Date-Time' },
  { value: 'json', label: 'JSON' },
  { value: 'enum', label: 'Enum' },
  { value: 'relation', label: 'Relation' },
];

export const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export const ENDPOINT_PARAM_LOCATIONS = ['path', 'query', 'header', 'cookie'] as const;

export type ApiDefinitionStatus =
  | 'draft'
  | 'validating'
  | 'ready'
  | 'publishing'
  | 'published'
  | 'superseded';

export const DEFINITION_STATUSES: readonly {
  value: ApiDefinitionStatus;
  label: string;
  tone: 'draft' | 'ready' | 'running' | 'published' | 'superseded';
}[] = [
  { value: 'draft', label: 'Draft', tone: 'draft' },
  { value: 'validating', label: 'Validating', tone: 'running' },
  { value: 'ready', label: 'Ready', tone: 'ready' },
  { value: 'publishing', label: 'Publishing', tone: 'running' },
  { value: 'published', label: 'Published', tone: 'published' },
  { value: 'superseded', label: 'Superseded', tone: 'superseded' },
];

export interface ValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface ValidationResult {
  readonly ok: boolean;
  readonly issues: readonly ValidationIssue[];
}

export type { ApiDefinition, ApiEndpoint, ApiField, ApiResource };

export function pluralize(name: string): string {
  if (name.endsWith('y')) return `${name.slice(0, -1)}ies`;
  if (name.endsWith('s')) return name;
  return `${name}s`;
}

export function fieldTypeLabel(type: string): string {
  return FIELD_TYPES.find((f) => f.value === type)?.label ?? type;
}
