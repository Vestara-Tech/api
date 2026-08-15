import type { ConfigurationService } from '../configuration/service/configuration-service.js';
import { ConfigurationService as ConfigurationServiceImpl } from '../configuration/service/configuration-service.js';
import { SchemaRegistry } from '../configuration/registry/schema-registry.js';
import { ConfigurationValidator } from '../configuration/validation/validator.js';
import { ConfigurationEventBus } from '../configuration/events/event-bus.js';
import { InMemoryRevisionStore } from '../configuration/lifecycle/revision-store.js';
import { secretReference } from '../configuration/domain/secret.js';
import type { AppConfig } from '../config/schema.js';

/**
 * Lightweight structural validator used until the platform wires a shared JSON
 * Schema / Ajv compiler. Validates scalars and required shape only.
 */
function structuralCheck(schema: unknown, value: unknown): readonly string[] {
  if (schema === null || typeof schema !== 'object') return [];
  const s = schema as { type?: string; properties?: Record<string, unknown>; required?: string[] };
  const issues: string[] = [];
  if (s.type && typeof value !== s.type) {
    if (!(s.type === 'integer' && typeof value === 'number' && Number.isInteger(value))) {
      issues.push(`expected ${s.type}, got ${typeof value}`);
    }
  }
  if (s.properties && value !== null && typeof value === 'object') {
    for (const [name, sub] of Object.entries(s.properties)) {
      const subValue = (value as Record<string, unknown>)[name];
      if (subValue !== undefined) issues.push(...structuralCheck(sub, subValue));
    }
  }
  return issues;
}

export function buildConfigurationService(config: AppConfig): ConfigurationService {
  const registry = new SchemaRegistry();

  registry.register({
    namespace: 'vestara.api',
    version: '1.0.0',
    schema: {
      type: 'object',
      properties: {
        host: { type: 'string' },
        port: { type: 'integer' },
        logLevel: { type: 'string' },
        requestTimeoutMs: { type: 'integer' },
      },
    },
    defaults: {
      host: config.host,
      port: config.port,
      logLevel: config.logLevel,
      requestTimeoutMs: config.requestTimeoutMs,
    },
    scope: ['system', 'environment', 'organization', 'workspace', 'project', 'module', 'service', 'runtime'],
  });

  registry.register({
    namespace: 'vestara.auth',
    version: '1.0.0',
    schema: {
      type: 'object',
      properties: {
        sessionTtlSeconds: { type: 'integer' },
        primarySecret: { type: 'string' },
        allowedOrigins: { type: 'object' },
      },
    },
    defaults: {
      sessionTtlSeconds: 604800,
    },
    scope: ['system', 'environment', 'organization', 'workspace'],
    secretFields: ['primarySecret'],
  });

  const service = new ConfigurationServiceImpl({
    registry,
    validator: new ConfigurationValidator(structuralCheck),
    revisionStore: new InMemoryRevisionStore(),
    layers: {
      environment: {
        'vestara.api.port': config.port,
        'vestara.api.host': config.host,
        'vestara.auth.primarySecret': secretReference('env', 'AUTH_PRIMARY_SECRET'),
      },
    },
    events: new ConfigurationEventBus(),
  });

  return service;
}
