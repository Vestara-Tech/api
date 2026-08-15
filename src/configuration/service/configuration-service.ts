import type {
  ConfigurationDefinition,
  ConfigurationKey,
  ConfigurationScopeLike,
  ConfigurationValidationResult,
  ResolvedConfigurationValue,
} from '../domain/types.js';
import { precedenceIndex } from '../domain/types.js';
import { badRequest } from '../../core/errors.js';
import type { ConfigurationApplySemantics, ConfigurationChangeKind } from '../events/types.js';
import { ConfigurationEventBus } from '../events/event-bus.js';
import type { RevisionStore, ConfigurationRevision } from '../lifecycle/revision-store.js';
import { InMemoryRevisionStore } from '../lifecycle/revision-store.js';
import { LayeredResolver, type ConfigurationLayers } from '../resolver/layered-resolver.js';
import { SchemaRegistry } from '../registry/schema-registry.js';
import { ConfigurationValidator } from '../validation/validator.js';

export interface ConfigurationServiceOptions {
  readonly registry: SchemaRegistry;
  readonly validator: ConfigurationValidator;
  readonly revisionStore?: RevisionStore;
  readonly layers?: Record<string, Readonly<Record<string, unknown>>>;
  readonly events?: ConfigurationEventBus;
}

export interface DraftInput {
  readonly scope: ConfigurationScopeLike;
  readonly values: Readonly<Record<string, unknown>>;
  readonly note?: string;
}

export class ConfigurationService {
  readonly registry: SchemaRegistry;
  private readonly validator: ConfigurationValidator;
  private readonly revisionStore: RevisionStore;
  private readonly layers: Record<string, Readonly<Record<string, unknown>>>;
  private readonly eventBus: ConfigurationEventBus;
  private readonly runtimeValues: Record<string, unknown> = {};
  private readonly resolver: LayeredResolver;

  constructor(options: ConfigurationServiceOptions) {
    this.registry = options.registry;
    this.validator = options.validator;
    this.revisionStore = options.revisionStore ?? new InMemoryRevisionStore();
    this.layers = options.layers ?? {};
    this.eventBus = options.events ?? new ConfigurationEventBus();
    this.resolver = new LayeredResolver(this.registry, this.layers as ConfigurationLayers);
  }

  // ── Resolve (CONFIG-003) ────────────────────────────────────

  resolve(key: string): ResolvedConfigurationValue | null {
    return this.resolver.resolve(key, this.runtimeValues);
  }

  resolveAll(): readonly ResolvedConfigurationValue[] {
    return this.resolver.resolveAll(this.runtimeValues);
  }

  asRecord(): Readonly<Record<string, unknown>> {
    return this.resolver.asRecord(this.runtimeValues);
  }

  setRuntimeOverride(key: string, value: unknown): void {
    this.runtimeValues[key] = value;
  }

  clearRuntimeOverride(key: string): void {
    delete this.runtimeValues[key];
  }

  // ── Definitions (CONFIG-002) ────────────────────────────────

  register<TValue>(definition: ConfigurationDefinition<TValue>): void {
    this.registry.register(definition);
  }

  keys(): readonly ConfigurationKey[] {
    return this.registry.keys();
  }

  // ── Lifecycle (CONFIG-006) ──────────────────────────────────

  async draft(input: DraftInput): Promise<ConfigurationRevision> {
    const revision = await this.revisionStore.create({
      scope: input.scope,
      values: input.values,
      ...(input.note !== undefined ? { note: input.note } : {}),
    });
    return revision;
  }

  async validateDraft(draftId: string): Promise<ConfigurationValidationResult> {
    const revision = await this.revisionStore.get(draftId);
    if (!revision) throw new Error(`Draft "${draftId}" not found`);
    return this.validateValues(revision.scope, revision.values);
  }

  private validateValues(scope: ConfigurationScopeLike, values: Record<string, unknown>): ConfigurationValidationResult {
    // Group provided keys by their owning namespace (namespace = prefix before
    // the second dot). This works even for namespaces with no defaults-derived
    // keys, so secret-field checks still run.
    const issues: import('../domain/types.js').ConfigurationValidationIssue[] = [];
    const byNamespace = new Map<string, Record<string, unknown>>();

    for (const [fullKey, value] of Object.entries(values)) {
      const dot = fullKey.indexOf('.');
      const secondDot = fullKey.indexOf('.', dot + 1);
      const namespace = secondDot === -1 ? fullKey : fullKey.slice(0, secondDot);
      if (!byNamespace.has(namespace)) byNamespace.set(namespace, {});
      byNamespace.get(namespace)![fullKey] = value;
    }

    for (const [namespace, subset] of byNamespace) {
      const definition = this.registry.get(namespace);
      if (!definition) continue;
      const valueResult = this.validator.validateValue(definition, subset);
      issues.push(...valueResult.issues);
      const secretResult = this.validator.validateSecrets(definition, subset);
      issues.push(...secretResult.issues);
    }
    return { ok: issues.every((i) => i.severity !== 'error'), issues };
  }

  async apply(draftId: string, appliedBy?: string): Promise<ConfigurationRevision> {
    const revision = await this.revisionStore.get(draftId);
    if (!revision) throw new Error(`Draft "${draftId}" not found`);
    if (revision.status !== 'draft') throw new Error(`Draft "${draftId}" already applied`);

    const validation = await this.validateDraft(draftId);
    if (!validation.ok) {
      throw badRequest(`Draft "${draftId}" failed validation: ${validation.issues.map((i) => i.message).join('; ')}`);
    }

    const previous = { ...(this.layers[String(revision.scope)] ?? {}) };
    this.layers[String(revision.scope)] = { ...revision.values };
    const applied = await this.revisionStore.markApplied(draftId, appliedBy);

    // Publish per-key change events.
    const now = new Date().toISOString();
    for (const [key, newValue] of Object.entries(revision.values)) {
      const hadPrevious = key in previous;
      this.eventBus.publish({
        key,
        scope: revision.scope,
        kind: hadPrevious ? 'update' : 'create',
        previousValue: hadPrevious ? previous[key] : undefined,
        newValue,
        semantics: this.semanticsFor(revision.scope, key),
        revisionId: draftId,
        occurredAt: now,
      });
    }
    return applied ?? revision;
  }

  async rollback(scope: ConfigurationScopeLike, appliedBy?: string): Promise<ConfigurationRevision | null> {
    const revisions = await this.revisionStore.listForScope(scope);
    const applied = revisions.find((r) => r.status === 'applied');
    if (!applied) return null;

    // Restore defaults: clear the layer for this scope.
    const previous = { ...(this.layers[String(scope)] ?? {}) };
    delete this.layers[String(scope)];
    const rolledBack = await this.revisionStore.markSuperseded(applied.id);

    const now = new Date().toISOString();
    for (const key of Object.keys(previous)) {
      this.eventBus.publish({
        key,
        scope,
        kind: 'rollback',
        previousValue: previous[key],
        newValue: undefined,
        semantics: 'hot-reload',
        revisionId: applied.id,
        occurredAt: now,
      });
    }
    return rolledBack;
  }

  async revisions(scope: ConfigurationScopeLike): Promise<readonly ConfigurationRevision[]> {
    return this.revisionStore.listForScope(scope);
  }

  // ── Events / watch (CONFIG-007) ─────────────────────────────

  watch(scope: ConfigurationScopeLike, listener: (event: import('../events/types.js').ConfigurationChangeEvent) => void): () => void {
    return this.eventBus.subscribe(scope, listener);
  }

  listenerCount(scope: ConfigurationScopeLike): number {
    return this.eventBus.listenerCount(scope);
  }

  /** Notify a change that happened outside the lifecycle (e.g. hot reload). */
  notify(key: string, scope: ConfigurationScopeLike, kind: ConfigurationChangeKind, previousValue?: unknown, newValue?: unknown): void {
    this.eventBus.publish({
      key,
      scope,
      kind,
      ...(previousValue !== undefined ? { previousValue } : {}),
      ...(newValue !== undefined ? { newValue } : {}),
      semantics: this.semanticsFor(scope, key),
      occurredAt: new Date().toISOString(),
    });
  }

  private semanticsFor(_scope: ConfigurationScopeLike, _key: string): ConfigurationApplySemantics {
    // Conservative default: unknown semantics. Package schemas can later mark
    // specific keys restart-required via metadata.
    return 'unknown';
  }
}

export { precedenceIndex, type ConfigurationApplySemantics, type ConfigurationChangeKind };
