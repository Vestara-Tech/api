/** PAGE-010/011/013 — Page validation, revisions and diff. */

import type { PageDefinition, PageNode } from './page-definition.js';

export interface PageValidationIssue {
  readonly path: string;
  readonly message: string;
  readonly severity: 'error' | 'warning';
}

export interface PageValidationResult {
  readonly ok: boolean;
  readonly issues: readonly PageValidationIssue[];
}

export interface ComponentResolver {
  has(definitionId: string): boolean;
}

/**
 * PAGE-010 — Page validation. Checks routes, node references against the
 * Component Module, action/event wiring, permission bindings and state keys.
 * The declarative definition is validated before any generation/preview.
 */
export class PageValidator {
  private readonly components: ComponentResolver;

  constructor(components: ComponentResolver) {
    this.components = components;
  }

  validate(page: PageDefinition): PageValidationResult {
    const issues: PageValidationIssue[] = [];

    if (!page.id) issues.push({ path: 'id', message: 'Page id is required', severity: 'error' });
    if (!page.name) issues.push({ path: 'name', message: 'Page name is required', severity: 'error' });
    if (!page.route.startsWith('/')) issues.push({ path: 'route', message: 'Route must start with "/"', severity: 'error' });

    const actionIds = new Set(page.actions.map((a) => a.id));
    for (const action of page.actions) {
      if (action.kind === 'workflow.start' && !action.target) {
        issues.push({ path: `actions.${action.id}`, message: 'workflow.start action requires a target workflow', severity: 'error' });
      }
    }

    const stateKeys = new Set(page.dataSources.filter((d) => d.source === 'state').map((d) => d.operation));
    for (const node of page.nodes) {
      this.validateNode(node, 'nodes', issues, actionIds);
    }

    // Validate the composed layout tree (the canonical composition).
    const layoutRoots = [page.layout.content, page.layout.header, page.layout.sidebar, page.layout.footer].filter((n): n is PageNode => n !== undefined);
    for (const root of layoutRoots) {
      this.validateNode(root, 'layout', issues, actionIds);
    }

    return { ok: issues.every((i) => i.severity !== 'error'), issues };
  }

  private validateNode(node: PageNode, path: string, issues: PageValidationIssue[], actionIds: Set<string>): void {
    if (!this.components.has(node.component.definitionId)) {
      issues.push({ path: `${path}.${node.id}`, message: `Unknown component "${node.component.definitionId}"`, severity: 'error' });
    }
    for (const event of node.events) {
      if (!actionIds.has(event.actionId)) {
        issues.push({ path: `${path}.${node.id}.events.${event.event}`, message: `Action "${event.actionId}" not defined`, severity: 'warning' });
      }
    }
    for (const binding of node.bindings) {
      if (binding.source === 'state' && !binding.operation) {
        issues.push({ path: `${path}.${node.id}.bindings.${binding.id}`, message: 'State binding requires an operation key', severity: 'error' });
      }
    }
    for (const child of node.children) {
      this.validateNode(child, `${path}.${node.id}.children`, issues, actionIds);
    }
  }
}

/** PAGE-011 — Page revisions. Declarative definitions are revisioned; edits create a new revision. */
export function bumpPageRevision(page: PageDefinition): PageDefinition {
  return { ...page, revision: page.revision + 1, updatedAt: new Date().toISOString() };
}

/** PAGE-013 — Page diff between two revisions (structural comparison). */
export interface PageDiffEntry {
  readonly path: string;
  readonly kind: 'added' | 'removed' | 'modified';
  readonly from?: unknown;
  readonly to?: unknown;
}

export function diffPages(a: PageDefinition, b: PageDefinition): readonly PageDiffEntry[] {
  const entries: PageDiffEntry[] = [];
  if (a.metadata.title !== b.metadata.title) entries.push({ path: 'metadata.title', kind: 'modified', from: a.metadata.title, to: b.metadata.title });
  if (a.route !== b.route) entries.push({ path: 'route', kind: 'modified', from: a.route, to: b.route });

  const nodeMap = (nodes: readonly PageNode[]): Map<string, PageNode> => new Map(nodes.map((n) => [n.id, n]));
  const aNodes = nodeMap(a.nodes);
  const bNodes = nodeMap(b.nodes);
  for (const [id, node] of aNodes) {
    if (!bNodes.has(id)) entries.push({ path: `nodes.${id}`, kind: 'removed', from: node });
  }
  for (const [id, node] of bNodes) {
    if (!aNodes.has(id)) entries.push({ path: `nodes.${id}`, kind: 'added', to: node });
  }
  return entries;
}
