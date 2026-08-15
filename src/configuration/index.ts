export type {
  ConfigurationScope,
  ConfigurationScopeLike,
  ConfigurationDefinition,
  ConfigurationKey,
  ConfigurationValue,
  ResolvedConfigurationValue,
  ConfigurationValidationIssue,
  ConfigurationValidationResult,
} from './domain/types.js';
export { SCOPE_PRECEDENCE, precedenceIndex } from './domain/types.js';
export type {
  SecretReference,
} from './domain/secret.js';
export {
  SECRET_REF_PREFIX,
  isSecretReference,
  secretReference,
  parseSecretRef,
  isSecretRefString,
  redactSecrets,
} from './domain/secret.js';
export { SchemaRegistry, leafEntries } from './registry/schema-registry.js';
export type {
  LayeredResolver,
  ConfigurationLayers,
  ResolveContext,
} from './resolver/layered-resolver.js';
export { ConfigurationValidator } from './validation/validator.js';
export type { ValidatorLike } from './validation/validator.js';
export type {
  ConfigurationChangeEvent,
  ConfigurationChangeKind,
  ConfigurationApplySemantics,
  ConfigurationChangeListener,
  ConfigurationWatcher,
} from './events/types.js';
export { ConfigurationEventBus } from './events/event-bus.js';
export type {
  ConfigurationRevision,
  ConfigurationRevisionStatus,
  RevisionStore,
} from './lifecycle/revision-store.js';
export { InMemoryRevisionStore } from './lifecycle/revision-store.js';
export type {
  ConfigurationService,
  ConfigurationServiceOptions,
  DraftInput,
} from './service/configuration-service.js';
export type {
  ConfigurationValueType,
  ReloadBehavior,
  ConfigurationRisk,
  ConfigurationFieldDefinition,
  ConfigurationContribution,
  ConfigurationPreset,
  ConfigurationScopeType,
  ConfigurationScopeRef,
  ConfigurationProvenanceEntry,
  ConfigurationProvenance,
  ConfigurationChange,
  ConfigurationTransactionStatus,
  ConfigurationTransaction,
  ConfigurationImpact,
} from './domain/expanded.js';
export { CONFIG_SCOPE_PRECEDENCE } from './domain/expanded.js';
export { ConfigurationContributionRegistry } from './registry/contribution-registry.js';
export { ProvenanceEngine } from './domain/provenance.js';
export { ConfigurationImpactAnalyzer } from './domain/impact.js';
export { ConfigurationTransactionService } from './service/transaction-service.js';
export type { ExpandedConfigurationServiceOptions } from './service/expanded-service.js';
export { ExpandedConfigurationService } from './service/expanded-service.js';
