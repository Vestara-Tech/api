import type { AiService } from '../ai/runtime/ai-runtime.js';
import type { ApiDefinitionService } from '../builder/service/api-definition-service.js';
import { AgentRegistry } from '../agent/registry/agent-registry.js';
import { BUILTIN_AGENTS } from '../agent/registry/builtin-agents.js';
import { AgentRunStateMachine } from '../agent/runtime/run-state-machine.js';
import { AgentRuntime } from '../agent/runtime/agent-runtime.js';
import { ToolRegistry } from '../tool/registry/tool-registry.js';
import { ToolPolicy } from '../tool/policy/tool-policy.js';
import { ToolRuntime } from '../tool/runtime/tool-runtime.js';
import { apiBuilderToolContributions } from '../tool/contributions/api-builder-tools.js';
import { SkillRegistry } from '../skill/registry/skill-registry.js';
import { SkillResolver } from '../skill/resolver/skill-resolver.js';
import { defineBuiltinSkills } from './skills.js';

export interface AgentPlatformOptions {
  readonly ai: AiService;
  readonly builder: ApiDefinitionService;
}

export interface AgentPlatform {
  readonly agents: AgentRegistry;
  readonly runs: AgentRunStateMachine;
  readonly runtime: AgentRuntime;
  readonly tools: ToolRegistry;
  readonly toolRuntime: ToolRuntime;
  readonly skills: SkillRegistry;
  readonly skillResolver: SkillResolver;
}

/**
 * Composition root for the Agent Platform (AGENT + TOOL + SKILL). Registers the
 * canonical agents, contributes module capabilities as tools, and wires the
 * tool execution runtime with authorization + approval policy.
 */
export function buildAgentPlatform(options: AgentPlatformOptions): AgentPlatform {
  // ── Tools ────────────────────────────────────────────────
  const tools = new ToolRegistry();
  for (const contribution of apiBuilderToolContributions(options.builder)) {
    tools.registerContribution(contribution);
  }
  const policy = new ToolPolicy({ autoApproveRisks: ['read', 'write'] });
  const toolRuntime = new ToolRuntime({ registry: tools, policy });

  // ── Agents (needed for the skill resolver capability check) ──
  const agents = new AgentRegistry();
  for (const agent of BUILTIN_AGENTS) agents.register(agent);

  // ── Skills ───────────────────────────────────────────────
  const skills = new SkillRegistry();
  for (const skill of defineBuiltinSkills()) skills.register(skill);
  const skillResolver = new SkillResolver({
    capabilities: async (agentId: string) => new Set(agents.get(agentId).permissions),
  });

  // ── Agent runtime ────────────────────────────────────────
  const runs = new AgentRunStateMachine();
  const runtime = new AgentRuntime({ agents, runs, tools: toolRuntime, skills, ai: options.ai });

  return { agents, runs, runtime, tools, toolRuntime, skills, skillResolver };
}
