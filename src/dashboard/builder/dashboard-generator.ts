/** DASH-GEN-001/002/005/006 — Dashboard Generator. */

import { randomId } from '../../core/identifiers.js';
import type { DashboardDefinition, DashboardScope, WidgetInstance } from '../domain/dashboard.js';
import type { DashboardWidgetRegistry } from '../registry/widget-registry.js';

export type DashboardGenerationTarget = 'definition' | 'application' | 'package' | 'template';

export interface DashboardGenerationPlan {
  readonly planId: string;
  readonly title: string;
  readonly scope: DashboardScope;
  readonly widgetTypes: readonly string[];
  readonly sourceModuleIds: readonly string[];
  readonly generatedAt: string;
}

export interface DashboardGenerationInput {
  readonly title?: string;
  readonly scope?: DashboardScope;
  readonly description?: string;
  readonly moduleIds?: readonly string[];
  readonly widgetTypes?: readonly string[];
  readonly layoutColumns?: number;
}

export interface DashboardGenerationResult {
  readonly plan: DashboardGenerationPlan;
  readonly definition: DashboardDefinition;
  readonly definitionHash: string;
}

/**
 * DASH-GEN-001/002 — Dashboard Generator. Discovers widgets from the registry
 * (no hard-coded module knowledge), composes a DashboardGenerationPlan and
 * produces a DashboardDefinition. Templates still produce normal
 * DashboardDefinition objects — templates are not a second format.
 */
export class DashboardGenerator {
  private readonly registry: DashboardWidgetRegistry;

  constructor(registry: DashboardWidgetRegistry) {
    this.registry = registry;
  }

  plan(input: DashboardGenerationInput): DashboardGenerationPlan {
    const sourceModules = input.moduleIds ?? this.registry.listModules();
    const widgetTypes = input.widgetTypes ?? this.registry.listWidgets().filter((w) => sourceModules.includes(w.moduleId)).map((w) => w.type);
    return {
      planId: randomId('dgen'),
      title: input.title ?? 'Generated Dashboard',
      scope: input.scope ?? 'system',
      widgetTypes,
      sourceModuleIds: sourceModules,
      generatedAt: new Date().toISOString(),
    };
  }

  generate(input: DashboardGenerationInput): DashboardGenerationResult {
    const plan = this.plan(input);
    const now = new Date().toISOString();
    const widgets: WidgetInstance[] = plan.widgetTypes.map((type, index) => ({
      id: `w${index + 1}`,
      type,
      configuration: {},
      placement: { x: (index % 3) * 4, y: Math.floor(index / 3) * 2, width: 4, height: 2, breakpoint: 'desktop' },
      state: 'loading',
      ...(this.registry.getWidgetSafe(type)?.refreshIntervalSeconds !== undefined ? { refreshIntervalSeconds: this.registry.getWidgetSafe(type)!.refreshIntervalSeconds } : {}),
    }));

    const definition: DashboardDefinition = {
      id: randomId('dash'),
      name: plan.title,
      ...(input.description !== undefined ? { description: input.description } : {}),
      scope: plan.scope,
      layout: { columns: input.layoutColumns ?? 12, rowHeight: 30, gap: 8, placements: [] },
      widgets,
      filters: [],
      refreshPolicy: { mode: 'interval', intervalSeconds: 30 },
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    return { plan, definition, definitionHash: hashOf(definition) };
  }

  /** DASH-GEN-005 — template generation produces a normal DashboardDefinition. */
  fromTemplate(template: DashboardDefinition): DashboardGenerationResult {
    const now = new Date().toISOString();
    const definition: DashboardDefinition = {
      ...template,
      id: randomId('dash'),
      name: template.name,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };
    const plan: DashboardGenerationPlan = {
      planId: randomId('dgen'),
      title: template.name,
      scope: template.scope,
      widgetTypes: template.widgets.map((w) => w.type),
      sourceModuleIds: this.registry.listModules(),
      generatedAt: now,
    };
    return { plan, definition, definitionHash: hashOf(definition) };
  }
}

function hashOf(value: unknown): string {
  const input = JSON.stringify(value);
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return `h_${Math.abs(hash).toString(36)}`;
}
