import { conflict, notFound } from '../../core/errors.js';
import type { Milestone } from '../contracts.js';

/** MS-004 — MilestoneStore (in-memory). */
export class MilestoneStore {
  private readonly milestones = new Map<string, Milestone>();

  create(milestone: Milestone): Milestone {
    if (this.milestones.has(milestone.id)) throw conflict(`Milestone "${milestone.id}" already exists`);
    this.milestones.set(milestone.id, milestone);
    return milestone;
  }

  get(id: string): Milestone {
    const milestone = this.milestones.get(id);
    if (!milestone) throw notFound(`Milestone "${id}" not found`);
    return milestone;
  }

  save(milestone: Milestone): Milestone {
    this.milestones.set(milestone.id, milestone);
    return milestone;
  }

  list(): readonly Milestone[] {
    return [...this.milestones.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  childrenOf(parentId: string): readonly Milestone[] {
    return this.list().filter((m) => m.parentMilestoneId === parentId);
  }
}
