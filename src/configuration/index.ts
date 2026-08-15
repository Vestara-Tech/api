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
