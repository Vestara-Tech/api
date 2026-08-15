import type { SkillDefinition, SkillValidationResult } from '../domain/contracts.js';

export interface SkillResolverOptions {
  readonly capabilities: (agentId: string) => ReadonlySet<string> | Promise<ReadonlySet<string>>;
}

export interface ResolvedSkill {
  readonly skill: SkillDefinition;
  readonly missingRequired: readonly string[];
  readonly matchedOptional: readonly string[];
}

/**
 * SKILL-005/006 — Skill resolver. Validates that an agent's capabilities
 * satisfy a skill's required capabilities, and composes the skill instructions
 * for a given agent.
 */
export class SkillResolver {
  private readonly capabilities: NonNullable<SkillResolverOptions['capabilities']>;

  constructor(options: SkillResolverOptions) {
    this.capabilities = options.capabilities;
  }

  async canUse(agentId: string, skill: SkillDefinition): Promise<SkillValidationResult> {
    const caps = await this.capabilities(agentId);
    const missing = skill.requiredCapabilities.filter((c) => !caps.has(c));
    return {
      ok: missing.length === 0,
      issues: missing.map((c) => ({
        path: `requiredCapabilities.${c}`,
        message: `agent lacks capability "${c}" required by skill "${skill.id}"`,
        severity: 'error' as const,
      })),
    };
  }

  async resolveFor(agentId: string, skill: SkillDefinition): Promise<ResolvedSkill> {
    const caps = await this.capabilities(agentId);
    const missingRequired = skill.requiredCapabilities.filter((c) => !caps.has(c));
    const matchedOptional = (skill.optionalCapabilities ?? []).filter((c) => caps.has(c));
    return { skill, missingRequired, matchedOptional };
  }

  composeInstructions(skills: readonly SkillDefinition[], baseInstructions: string): string {
    const parts = [baseInstructions];
    for (const skill of skills) {
      parts.push(`\n## Skill: ${skill.name} (${skill.id})\n${skill.instructions}`);
    }
    return parts.join('\n');
  }
}
