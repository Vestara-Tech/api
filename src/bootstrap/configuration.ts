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

  registry.register({
    namespace: 'vestara.system.boot',
    version: '1.0.0',
    schema: {
      type: 'object',
      properties: {
        'presentation.profile': { type: 'string' },
        'presentation.plymouth.enabled': { type: 'boolean' },
        'presentation.grub.enabled': { type: 'boolean' },
        'presentation.quietBoot': { type: 'boolean' },
        'presentation.showStatusOnFailure': { type: 'boolean' },
        'presentation.recoveryProfile': { type: 'string' },
        'presentation.firmwareLogo.enabled': { type: 'boolean' },
      },
    },
    defaults: {
      'presentation.profile': 'vestara-default',
      'presentation.plymouth.enabled': true,
      'presentation.grub.enabled': true,
      'presentation.quietBoot': true,
      'presentation.showStatusOnFailure': true,
      'presentation.recoveryProfile': 'vestara-recovery',
      'presentation.firmwareLogo.enabled': false,
    },
    scope: ['system', 'environment', 'workspace'],
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

import { ConfigurationContributionRegistry } from '../configuration/registry/contribution-registry.js';
import { ProvenanceEngine } from '../configuration/domain/provenance.js';
import { ConfigurationImpactAnalyzer } from '../configuration/domain/impact.js';
import { ConfigurationTransactionService } from '../configuration/service/transaction-service.js';
import { ExpandedConfigurationService } from '../configuration/service/expanded-service.js';

export interface ExpandedConfigurationPlatform {
  readonly contributions: ConfigurationContributionRegistry;
  readonly expanded: ExpandedConfigurationService;
}

/**
 * CONFIG-009..016 — composition root for the expanded configuration plane.
 * Built on top of the existing base ConfigurationService.
 */
export function buildExpandedConfiguration(base: ConfigurationService): ExpandedConfigurationPlatform {
  const contributions = new ConfigurationContributionRegistry();
  const provenance = new ProvenanceEngine();
  const impact = new ConfigurationImpactAnalyzer(contributions);
  const transactions = new ConfigurationTransactionService();
  const expanded = new ExpandedConfigurationService({ contributions, provenance, impact, transactions, base });
  return { contributions, expanded };
}
