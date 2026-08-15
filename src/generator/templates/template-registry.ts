import { conflict, notFound } from '../../core/errors.js';

export interface TemplateDefinition {
  readonly id: string;
  readonly version: string;
  readonly source: string;
  readonly description?: string;
  readonly defaultContext?: Readonly<Record<string, unknown>>;
}

export interface RenderContext {
  readonly values: Readonly<Record<string, unknown>>;
}

export type TemplateRenderer = (template: TemplateDefinition, context: RenderContext) => string;

export interface TemplateRegistry {
  register(template: TemplateDefinition): void;
  get(id: string): TemplateDefinition | null;
  getVersion(id: string, version: string): TemplateDefinition | null;
  list(): readonly TemplateDefinition[];
  has(id: string): boolean;
}

/**
 * In-memory template registry with per-template versioning. Renderers are
 * supplied by the platform (e.g. a `{{ }}` substitution renderer or a more
 * powerful engine); the registry itself stays storage-agnostic.
 */
export class InMemoryTemplateRegistry implements TemplateRegistry {
  private readonly templates = new Map<string, Map<string, TemplateDefinition>>();

  register(template: TemplateDefinition): void {
    const versions = this.templates.get(template.id) ?? new Map<string, TemplateDefinition>();
    if (versions.has(template.version)) {
      throw conflict(`Template "${template.id}@${template.version}" already registered`);
    }
    versions.set(template.version, template);
    this.templates.set(template.id, versions);
  }

  get(id: string): TemplateDefinition | null {
    const versions = this.templates.get(id);
    if (!versions || versions.size === 0) return null;
    // Latest by semver-ish ordering: default to the last registered version.
    const latest = [...versions.values()].sort((a, b) => b.version.localeCompare(a.version))[0];
    return latest ?? null;
  }

  getVersion(id: string, version: string): TemplateDefinition | null {
    return this.templates.get(id)?.get(version) ?? null;
  }

  list(): readonly TemplateDefinition[] {
    const out: TemplateDefinition[] = [];
    for (const versions of this.templates.values()) {
      out.push(...versions.values());
    }
    return out.sort((a, b) => `${a.id}@${a.version}`.localeCompare(`${b.id}@${b.version}`));
  }

  has(id: string): boolean {
    return this.templates.has(id);
  }
}

/**
 * Simple deterministic `{{ key }}` substitution renderer. Nested keys use
 * dot-notation (`{{ config.port }}`). Missing keys render as empty string and
 * are reported via a callback (used for validation).
 */
export function substitutionRenderer(template: TemplateDefinition, context: RenderContext, onMissing?: (key: string) => void): string {
  const merged = { ...(template.defaultContext ?? {}), ...context.values };
  return template.source.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    const value = lookup(merged, key);
    if (value === undefined) {
      onMissing?.(key);
      return '';
    }
    return String(value);
  });
}

function lookup(record: Readonly<Record<string, unknown>>, dotted: string): unknown {
  let current: unknown = record;
  for (const part of dotted.split('.')) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}
