import { badRequest, conflict, notFound } from '../../core/errors.js';
import type { WorkflowDefinition } from '../domain/contracts.js';
import { WorkflowGraph } from '../domain/graph.js';

export interface WorkflowRevision {
  readonly definition: WorkflowDefinition;
  readonly recordedAt: string;
  readonly publishedAt?: string;
}

/**
 * WF-001 — Workflow definition registry. Holds definitions (draft/published/
 * superseded) and their published revisions. Definitions are validated as DAGs
 * on registration.
 */
export class WorkflowRegistry {
  private readonly definitions = new Map<string, WorkflowDefinition>();
  private readonly revisions = new Map<string, WorkflowRevision[]>();

  register(input: WorkflowDefinition): WorkflowDefinition {
    if (this.definitions.has(input.id)) throw conflict(`Workflow "${input.id}" already registered`);
    const graph = new WorkflowGraph(input);
    const validation = graph.validate();
    if (!validation.ok) {
      throw badRequest(`Workflow "${input.id}" invalid: ${validation.issues.map((i) => i.message).join('; ')}`);
    }
    this.definitions.set(input.id, input);
    return input;
  }

  update(definition: WorkflowDefinition): WorkflowDefinition {
    if (!this.definitions.has(definition.id)) throw notFound(`Workflow "${definition.id}" not found`);
    const graph = new WorkflowGraph(definition);
    const validation = graph.validate();
    if (!validation.ok) {
      throw badRequest(`Workflow "${definition.id}" invalid: ${validation.issues.map((i) => i.message).join('; ')}`);
    }
    this.definitions.set(definition.id, definition);
    return definition;
  }

  publish(id: string): WorkflowDefinition {
    const current = this.get(id);
    if (current.status === 'published') return current;
    const published: WorkflowDefinition = { ...current, status: 'published', revision: current.revision + 1 };
    this.definitions.set(id, published);
    const list = this.revisions.get(id) ?? [];
    list.push({ definition: published, recordedAt: new Date().toISOString(), publishedAt: new Date().toISOString() });
    this.revisions.set(id, list);
    return published;
  }

  get(id: string): WorkflowDefinition {
    const definition = this.definitions.get(id);
    if (!definition) throw notFound(`Workflow "${id}" not found`);
    return definition;
  }

  has(id: string): boolean {
    return this.definitions.has(id);
  }

  list(): readonly WorkflowDefinition[] {
    return [...this.definitions.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listRevisions(id: string): readonly WorkflowRevision[] {
    return this.revisions.get(id) ?? [];
  }
}
