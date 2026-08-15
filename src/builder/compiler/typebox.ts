import { Type, type TSchema } from '@sinclair/typebox';
import type { ApiField } from '../domain/types.js';

export function fieldSchema(field: ApiField): TSchema {
  const base = primitiveSchema(field);
  const withConstraints = applyConstraints(base, field);
  const schema = field.required ? withConstraints : Type.Optional(withConstraints);
  if (field.description !== undefined) {
    const desc = schema as TSchema & { description?: string };
    desc.description = field.description;
  }
  return schema;
}

function primitiveSchema(field: ApiField): TSchema {
  switch (field.type) {
    case 'string':
      return Type.String();
    case 'text':
      return Type.String();
    case 'number':
      return Type.Number();
    case 'integer':
      return Type.Integer();
    case 'boolean':
      return Type.Boolean();
    case 'uuid':
      return Type.String({ format: 'uuid' });
    case 'email':
      return Type.String({ format: 'email' });
    case 'url':
      return Type.String({ format: 'uri' });
    case 'date':
      return Type.String({ format: 'date' });
    case 'date-time':
      return Type.String({ format: 'date-time' });
    case 'json':
      return Type.Unknown();
    case 'enum':
      return field.enumValues && field.enumValues.length > 0
        ? Type.Union(field.enumValues.map((v) => Type.Literal(v)))
        : Type.String();
    case 'relation':
      return Type.String();
    default:
      return Type.Unknown();
  }
}

function applyConstraints(schema: TSchema, field: ApiField): TSchema {
  const constraints: Record<string, unknown> = {};
  if (field.minLength !== undefined) constraints.minLength = field.minLength;
  if (field.maxLength !== undefined) constraints.maxLength = field.maxLength;
  if (field.minimum !== undefined) constraints.minimum = field.minimum;
  if (field.maximum !== undefined) constraints.maximum = field.maximum;
  if (field.format !== undefined) constraints.format = field.format;
  if (Object.keys(constraints).length === 0) return schema;

  // Merge constraints onto the schema options (numbers/strings share JSON-Schema
  // keyword space), avoiding the need for an Intersect of heterogeneous types.
  const out = { ...(schema as Record<string, unknown>) } as Record<string, unknown> & { [key: string]: unknown };
  for (const [key, value] of Object.entries(constraints)) out[key] = value;
  return out as TSchema;
}
