import type { SkillRegistry } from '../../skill/registry/skill-registry.js';
import type { SkillResolver } from '../../skill/resolver/skill-resolver.js';
import { ExecutionSkillResolver } from '../../skill/resolver/execution-skill-resolver.js';
import type { AgentDefinition, AgentRun, SkillSelector } from '../domain/contracts.js';
import type {
  AgentExecutionContext,
  AgentIdentityContext,
  ObjectiveContext,
  GovernanceContext,
  RepositoryContext,
  ContinuityContext,
  ConversationContext,
  ExecutionContextItem,
  ResolvedExecutionSkill,
  ContextSelectionMetadata,
} from './execution-context.js';
import { selectContext, type ContextSelectionPolicy } from './context-selector.js';

/** DEX-CP2 — Input for assembling the canonical execution context. */
export interface ExecutionContextInput {
  readonly agent: AgentDefinition;
  readonly run: AgentRun;
  readonly goal?: string;
  readonly task?: string;
  readonly acceptanceCriteria?: readonly string[];
  readonly constraints?: readonly string[];
  readonly workflowStep?: string;
  readonly toolDescriptions?: readonly string[];
  readonly repository?: RepositoryContext;
  readonly continuity?: ContinuityContext;
  readonly conversation?: ConversationContext;
  readonly budgetTokens?: number;
}

/** DEX-CP2 — Assembler dependencies. */
export interface ExecutionContextAssemblerDeps {
  readonly skillRegistry: SkillRegistry;
  readonly skillResolver: SkillResolver;
}

/** Estimated tokens for a rough character-to-token heuristic (4 chars ≈ 1 token). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Build a context item from a string value. */
function toItem(
  id: string,
  source: ExecutionContextItem['source'],
  layer: ExecutionContextItem['layer'],
  content: string,
  required: boolean,
  priority: number,
  extra?: Partial<Pick<ExecutionContextItem, 'provenance'>>,
): ExecutionContextItem {
  return {
    id,
    source,
    layer,
    required,
    priority,
    content,
    estimatedTokens: estimateTokens(content),
    provenance: {
      source,
      resolvedAt: new Date().toISOString(),
      ...extra?.provenance,
    },
  };
}

/**
 * DEX-CP2 CTX-009 — Canonical execution context assembler.
 *
 * Builds a runtime-neutral, provenance-aware, budgetable AgentExecutionContext
 * from agent definition, run state, and optional contextual inputs.
 *
 * This does NOT format for any specific runtime. That is the job of
 * serializers (CTX-010) which consume this output.
 */
export class ExecutionContextAssembler {
  private readonly executionSkillResolver: ExecutionSkillResolver;

  constructor(deps: ExecutionContextAssemblerDeps) {
    this.executionSkillResolver = new ExecutionSkillResolver({
      registry: deps.skillRegistry,
      resolver: deps.skillResolver,
    });
  }

  /**
   * Assemble the canonical execution context.
   *
   * Resolution order (matches ADR layers):
   *   L0 Identity → L1 Objective → L2 Governance → L3 Repository → L4 Continuity → L5 Conversation
   */
  async assemble(input: ExecutionContextInput): Promise<AgentExecutionContext> {
    const identity = this.buildIdentity(input);
    const objective = this.buildObjective(input);
    const governance = await this.buildGovernance(input);
    const repository = input.repository;
    const continuity = input.continuity;
    const conversation = input.conversation;

    // Build context items for selection.
    const items = this.buildContextItems(input, identity, objective, governance);

    // Apply selection with budget.
    const budget = input.budgetTokens ?? 128_000;
    const selectionResult = selectContext(items, { budgetTokens: budget });

    return {
      identity,
      objective,
      governance,
      repository,
      continuity,
      conversation,
      selection: selectionResult.metadata,
    };
  }

  /**
   * Build context items from all layers for selection.
   * This is used internally and exposed for testing.
   */
  buildContextItems(
    input: ExecutionContextInput,
    identity: AgentIdentityContext,
    objective: ObjectiveContext,
    governance: GovernanceContext,
  ): ExecutionContextItem[] {
    const items: ExecutionContextItem[] = [];
    const now = new Date().toISOString();

    // L0 Identity — always required, highest priority.
    items.push(toItem('identity.agent', 'agent-definition', 'identity',
      `Agent: ${identity.agentName} (${identity.agentId}@${identity.agentVersion}), role: ${identity.role}, run: ${identity.runId}`,
      true, 100, { provenance: { source: 'agent-definition', resolvedAt: now } }));

    // L1 Objective — required if present.
    if (objective.goal) {
      items.push(toItem('objective.goal', 'caller', 'objective',
        `Goal: ${objective.goal}`,
        true, 90, { provenance: { source: 'caller', resolvedAt: now } }));
    }
    if (objective.task) {
      items.push(toItem('objective.task', 'caller', 'objective',
        `Task: ${objective.task}`,
        true, 85, { provenance: { source: 'caller', resolvedAt: now } }));
    }
    if (objective.acceptanceCriteria && objective.acceptanceCriteria.length > 0) {
      items.push(toItem('objective.criteria', 'caller', 'objective',
        `Acceptance criteria:\n${objective.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}`,
        false, 80, { provenance: { source: 'caller', resolvedAt: now } }));
    }
    if (objective.constraints && objective.constraints.length > 0) {
      items.push(toItem('objective.constraints', 'caller', 'objective',
        `Constraints:\n${objective.constraints.map((c) => `- ${c}`).join('\n')}`,
        true, 88, { provenance: { source: 'caller', resolvedAt: now } }));
    }
    if (objective.workflowStep) {
      items.push(toItem('objective.workflow-step', 'workflow', 'objective',
        `Workflow step: ${objective.workflowStep}`,
        false, 75, { provenance: { source: 'workflow', resolvedAt: now } }));
    }

    // L2 Governance — system instructions required, skills/tools required.
    items.push(toItem('governance.system', 'agent-definition', 'governance',
      governance.systemInstructions,
      true, 95, { provenance: { source: 'agent-definition', resolvedAt: now } }));

    if (governance.guardrails.length > 0) {
      items.push(toItem('governance.guardrails', 'agent-definition', 'governance',
        `Guardrails:\n${governance.guardrails.map((g) => `- ${g}`).join('\n')}`,
        true, 92, { provenance: { source: 'agent-definition', resolvedAt: now } }));
    }

    for (const skill of governance.skills) {
      items.push(toItem(`governance.skill.${skill.id}`, 'skill-registry', 'governance',
        `## Skill: ${skill.name} (${skill.id}@${skill.version})\n${skill.instructions}`,
        !skill.optional, 70, {
          provenance: { source: 'skill-registry', resolvedAt: now, skillId: skill.id, version: skill.version },
        }));
    }

    if (governance.toolDescriptions.length > 0) {
      items.push(toItem('governance.tools', 'tool-registry', 'governance',
        `Available tools: ${governance.toolDescriptions.join(', ')}`,
        true, 65, { provenance: { source: 'tool-registry', resolvedAt: now } }));
    }

    if (governance.permissions.length > 0) {
      items.push(toItem('governance.permissions', 'agent-definition', 'governance',
        `Permissions: ${governance.permissions.join(', ')}`,
        true, 93, { provenance: { source: 'agent-definition', resolvedAt: now } }));
    }

    // L3 Repository — optional.
    if (input.repository) {
      const repo = input.repository;
      const repoParts = [`Repository: ${repo.root}`];
      if (repo.branch) repoParts.push(`Branch: ${repo.branch}`);
      if (repo.headSha) repoParts.push(`HEAD: ${repo.headSha}`);
      if (repo.workingTreeState) repoParts.push(`Working tree: ${repo.workingTreeState}`);
      if (repo.changedFiles && repo.changedFiles.length > 0) {
        repoParts.push(`Changed files:\n${repo.changedFiles.map((f) => `- ${f}`).join('\n')}`);
      }
      if (repo.relevantFiles && repo.relevantFiles.length > 0) {
        repoParts.push(`Relevant files:\n${repo.relevantFiles.map((f) => `- ${f}`).join('\n')}`);
      }
      items.push(toItem('repository.state', 'repository', 'repository',
        repoParts.join('\n'),
        false, 60, { provenance: { source: 'repository', resolvedAt: now } }));
    }

    // L4 Continuity — optional.
    if (input.continuity) {
      const c = input.continuity;
      const contParts: string[] = [];
      if (c.workflowId) contParts.push(`Workflow: ${c.workflowId}`);
      if (c.currentMilestone) contParts.push(`Milestone: ${c.currentMilestone}`);
      if (c.currentTask) contParts.push(`Current task: ${c.currentTask}`);
      if (c.completedPredecessors && c.completedPredecessors.length > 0) {
        contParts.push(`Completed predecessors:\n${c.completedPredecessors.map((p) => `- ${p}`).join('\n')}`);
      }
      if (c.plannerOutput) contParts.push(`Planner output:\n${c.plannerOutput}`);
      if (c.previousIteration) contParts.push(`Previous iteration:\n${c.previousIteration}`);
      if (c.reviewerFeedback) contParts.push(`Reviewer feedback:\n${c.reviewerFeedback}`);
      if (contParts.length > 0) {
        items.push(toItem('continuity.state', 'workflow', 'continuity',
          contParts.join('\n'),
          false, 55, { provenance: { source: 'workflow', resolvedAt: now } }));
      }
    }

    // L5 Conversation — optional.
    if (input.conversation) {
      const conv = input.conversation;
      const convParts: string[] = [];
      if (conv.sessionId) convParts.push(`Session: ${conv.sessionId}`);
      if (conv.parentSessionId) convParts.push(`Parent session: ${conv.parentSessionId}`);
      if (conv.messageHistory && conv.messageHistory.length > 0) {
        convParts.push(`Message history (${conv.messageHistory.length} messages):\n${conv.messageHistory.join('\n')}`);
      }
      if (convParts.length > 0) {
        items.push(toItem('conversation.state', 'caller', 'conversation',
          convParts.join('\n'),
          false, 50, { provenance: { source: 'caller', resolvedAt: now } }));
      }
    }

    return items;
  }

  private buildIdentity(input: ExecutionContextInput): AgentIdentityContext {
    return {
      agentId: input.agent.id,
      agentVersion: input.agent.version,
      agentName: input.agent.name,
      role: input.agent.role,
      runId: input.run.id,
    };
  }

  private buildObjective(input: ExecutionContextInput): ObjectiveContext {
    return {
      goal: input.goal,
      task: input.task,
      acceptanceCriteria: input.acceptanceCriteria,
      constraints: input.constraints,
      workflowStep: input.workflowStep,
    };
  }

  private async buildGovernance(input: ExecutionContextInput): Promise<GovernanceContext> {
    const selectors: readonly SkillSelector[] = input.agent.skills;
    const resolution = await this.executionSkillResolver.resolve(
      selectors,
      input.agent.role,
      input.agent.id,
    );

    const resolvedSkills: readonly ResolvedExecutionSkill[] = resolution.resolved;

    const guardrails = input.agent.instructions.guardrails ?? [];
    const skillsSummary = resolvedSkills.length > 0
      ? resolvedSkills.map((s) => s.id).join(', ')
      : 'none assigned';

    // Compose system instructions (agent base + skill instructions).
    const systemParts = [input.agent.instructions.system];
    for (const skill of resolvedSkills) {
      systemParts.push(`\n## Skill: ${skill.name} (${skill.id})\n${skill.instructions}`);
    }

    return {
      systemInstructions: systemParts.join('\n'),
      guardrails,
      skills: resolvedSkills,
      toolDescriptions: input.toolDescriptions ? [...input.toolDescriptions] : [],
      permissions: [...input.agent.permissions],
    };
  }
}
