import type { SkillDefinition, SkillResource } from '../domain/contracts.js';
import type { SkillSelector } from '../../agent/domain/contracts.js';
import type { SkillResolver, ResolvedSkill } from './skill-resolver.js';
import type { SkillRegistry } from '../registry/skill-registry.js';
import type { AgentRole } from '../../agent/domain/contracts.js';

/** DEX-CP1 — A skill resolved for execution, ready for context assembly. */
export interface ResolvedExecutionSkill {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly instructions: string;
  readonly resources: readonly SkillResource[];
  readonly roleCompatible: boolean;
  readonly missingRequired: readonly string[];
  readonly matchedOptional: readonly string[];
  readonly optional: boolean;
}

/** DEX-CP1 — Diagnostic for skills that could not be resolved. */
export interface SkillResolutionDiagnostic {
  readonly skillId: string;
  readonly reason: 'not-found' | 'role-incompatible' | 'missing-capabilities';
  readonly detail: string;
  readonly optional: boolean;
}

/** DEX-CP1 — Result of resolving a set of skill selectors for an agent. */
export interface SkillResolutionResult {
  readonly resolved: readonly ResolvedExecutionSkill[];
  readonly diagnostics: readonly SkillResolutionDiagnostic[];
  readonly appliedCount: number;
  readonly skippedCount: number;
  readonly totalInstructionLength: number;
}

export interface ExecutionSkillResolverOptions {
  readonly registry: SkillRegistry;
  readonly resolver: SkillResolver;
}

/**
 * DEX-CP1 — Execution skill resolver. Takes SkillSelectors from an
 * AgentDefinition, looks up each in the SkillRegistry, validates role
 * compatibility and capability requirements, and produces resolved
 * execution skills for context assembly.
 *
 * This does NOT redesign assembleAgentContext() — it produces the
 * input contract CP2 will consume.
 */
export class ExecutionSkillResolver {
  private readonly registry: SkillRegistry;
  private readonly resolver: SkillResolver;

  constructor(options: ExecutionSkillResolverOptions) {
    this.registry = options.registry;
    this.resolver = options.resolver;
  }

  /**
   * Resolve a set of skill selectors for an agent into execution-ready skills.
   *
   * Resolution order:
   *   1. Look up skill in registry
   *   2. Validate role compatibility
   *   3. Validate capability requirements via SkillResolver
   *   4. Produce ResolvedExecutionSkill with instructions + resources
   *
   * Missing optional skills produce diagnostics but do not fail resolution.
   * Missing required skills produce diagnostics and are excluded from resolved.
   */
  async resolve(
    selectors: readonly SkillSelector[],
    agentRole: AgentRole,
    agentId: string,
  ): Promise<SkillResolutionResult> {
    const resolved: ResolvedExecutionSkill[] = [];
    const diagnostics: SkillResolutionDiagnostic[] = [];
    let totalInstructionLength = 0;

    for (const selector of selectors) {
      const result = await this.resolveOne(selector, agentRole, agentId);

      if (result.resolved) {
        resolved.push(result.resolved);
        totalInstructionLength += result.resolved.instructions.length;
      }

      if (result.diagnostic) {
        diagnostics.push(result.diagnostic);
      }
    }

    // Deterministic ordering: sort by id for stable context assembly.
    const sorted = [...resolved].sort((a, b) => a.id.localeCompare(b.id));

    return {
      resolved: sorted,
      diagnostics,
      appliedCount: sorted.length,
      skippedCount: selectors.length - sorted.length,
      totalInstructionLength,
    };
  }

  private async resolveOne(
    selector: SkillSelector,
    agentRole: AgentRole,
    agentId: string,
  ): Promise<{ resolved?: ResolvedExecutionSkill; diagnostic?: SkillResolutionDiagnostic }> {
    const { id, optional = false } = selector;

    // 1. Look up in registry.
    if (!this.registry.has(id)) {
      return {
        diagnostic: {
          skillId: id,
          reason: 'not-found',
          detail: `Skill "${id}" not found in registry`,
          optional,
        },
      };
    }

    const skill = this.registry.get(id);

    // 2. Validate role compatibility.
    const roleCompatible = this.checkRoleCompatibility(skill, agentRole);
    if (!roleCompatible) {
      return {
        diagnostic: {
          skillId: id,
          reason: 'role-incompatible',
          detail: `Skill "${id}" is not compatible with role "${agentRole}" (compatible: ${skill.compatibleRoles?.join(', ') ?? 'any'})`,
          optional,
        },
      };
    }

    // 3. Validate capability requirements.
    const capabilityResult = await this.resolver.resolveFor(agentId, skill);

    // 4. Produce resolved execution skill.
    return {
      resolved: {
        id: skill.id,
        version: skill.version,
        name: skill.name,
        instructions: skill.instructions,
        resources: skill.resources ?? [],
        roleCompatible,
        missingRequired: capabilityResult.missingRequired,
        matchedOptional: capabilityResult.matchedOptional,
        optional,
      },
    };
  }

  private checkRoleCompatibility(skill: SkillDefinition, agentRole: AgentRole): boolean {
    // If no compatibleRoles is specified, the skill is compatible with all roles.
    if (!skill.compatibleRoles || skill.compatibleRoles.length === 0) {
      return true;
    }
    return skill.compatibleRoles.includes(agentRole);
  }
}
