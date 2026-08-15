import { conflict, notFound } from '../../core/errors.js';
import type { SkillDefinition } from '../domain/contracts.js';
import { validateSkill } from '../validation/skill-validator.js';

/**
 * SKILL-004 — Skill registry. Skills are reusable procedural knowledge,
 * attachable to multiple agents rather than hardwired into an agent.
 */
export class SkillRegistry {
  private readonly skills = new Map<string, SkillDefinition>();

  register(skill: SkillDefinition): void {
    const validation = validateSkill(skill);
    if (!validation.ok) {
      throw new Error(`Skill "${skill.id}" invalid: ${validation.issues.map((i) => i.message).join('; ')}`);
    }
    if (this.skills.has(skill.id)) throw conflict(`Skill "${skill.id}" already registered`);
    this.skills.set(skill.id, skill);
  }

  get(id: string): SkillDefinition {
    const skill = this.skills.get(id);
    if (!skill) throw notFound(`Skill "${id}" not found`);
    return skill;
  }

  has(id: string): boolean {
    return this.skills.has(id);
  }

  list(): readonly SkillDefinition[] {
    return [...this.skills.values()].sort((a, b) => a.id.localeCompare(b.id));
  }
}
