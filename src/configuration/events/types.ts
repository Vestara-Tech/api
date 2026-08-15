/**
 * CONFIG-007 — Change events and watchers.
 *
 * Modules subscribe to configuration changes instead of polling files. Events
 * carry hot-reload vs restart-required semantics so consumers react correctly.
 */

import type { ConfigurationScopeLike } from '../domain/types.js';

export type { ConfigurationScopeLike } from '../domain/types.js';

export type ConfigurationChangeKind = 'create' | 'update' | 'delete' | 'rollback' | 'apply';

export type ConfigurationApplySemantics = 'hot-reload' | 'restart-required' | 'unknown';

export interface ConfigurationChangeEvent {
  readonly key: string;
  readonly scope: ConfigurationScopeLike;
  readonly kind: ConfigurationChangeKind;
  readonly previousValue?: unknown;
  readonly newValue?: unknown;
  readonly semantics: ConfigurationApplySemantics;
  readonly revisionId?: string;
  readonly occurredAt: string;
}

export type ConfigurationChangeListener = (event: ConfigurationChangeEvent) => void | Promise<void>;

export interface ConfigurationWatcher {
  watch(scope: ConfigurationScopeLike, listener: ConfigurationChangeListener): () => void;
}
