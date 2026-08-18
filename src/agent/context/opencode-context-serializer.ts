import type { AgentExecutionContext } from './execution-context.js';

/**
 * DEX-CP2 CTX-010 — OpenCode context serializer.
 *
 * Transforms the runtime-neutral AgentExecutionContext into
 * OpenCode-specific prompt structures. This is the ONLY place
 * where OpenCode-specific formatting lives.
 *
 * Dependency direction:
 *   CAR/OpenCode depends on AgentExecutionContext
 *   NOT the other way around.
 */

/** Serialized output for OpenCode prompt/session. */
export interface OpenCodeSerializedContext {
  readonly systemPrompt: string;
  readonly sections: readonly OpenCodeContextSection[];
}

export interface OpenCodeContextSection {
  readonly heading: string;
  readonly content: string;
  readonly priority: number;
}

/**
 * Serialize an AgentExecutionContext for OpenCode consumption.
 *
 * Produces a structured system prompt and ordered sections that
 * the OpenCode adapter can format into session/prompt structures.
 */
export function serializeForOpenCode(context: AgentExecutionContext): OpenCodeSerializedContext {
  const sections: OpenCodeContextSection[] = [];

  // L0 Identity — always present.
  sections.push({
    heading: 'Agent Identity',
    content: [
      `Agent: ${context.identity.agentName} (${context.identity.agentId})`,
      `Version: ${context.identity.agentVersion}`,
      `Role: ${context.identity.role}`,
      `Run: ${context.identity.runId}`,
    ].join('\n'),
    priority: 100,
  });

  // L1 Objective — if present.
  if (context.objective.goal || context.objective.task) {
    const parts: string[] = [];
    if (context.objective.goal) parts.push(`Goal: ${context.objective.goal}`);
    if (context.objective.task) parts.push(`Task: ${context.objective.task}`);
    if (context.objective.acceptanceCriteria && context.objective.acceptanceCriteria.length > 0) {
      parts.push(`Acceptance criteria:\n${context.objective.acceptanceCriteria.map((c) => `- ${c}`).join('\n')}`);
    }
    if (context.objective.constraints && context.objective.constraints.length > 0) {
      parts.push(`Constraints:\n${context.objective.constraints.map((c) => `- ${c}`).join('\n')}`);
    }
    if (context.objective.workflowStep) parts.push(`Workflow step: ${context.objective.workflowStep}`);
    sections.push({ heading: 'Objective', content: parts.join('\n'), priority: 90 });
  }

  // L2 Governance — always present.
  const govParts: string[] = [];
  govParts.push(`System instructions:\n${context.governance.systemInstructions}`);
  if (context.governance.guardrails.length > 0) {
    govParts.push(`Guardrails:\n${context.governance.guardrails.map((g) => `- ${g}`).join('\n')}`);
  }
  if (context.governance.skills.length > 0) {
    govParts.push(`Skills: ${context.governance.skills.map((s) => `${s.id}@${s.version}`).join(', ')}`);
  }
  if (context.governance.toolDescriptions.length > 0) {
    govParts.push(`Available tools: ${context.governance.toolDescriptions.join(', ')}`);
  }
  if (context.governance.permissions.length > 0) {
    govParts.push(`Permissions: ${context.governance.permissions.join(', ')}`);
  }
  sections.push({ heading: 'Governance', content: govParts.join('\n\n'), priority: 95 });

  // L3 Repository — if present.
  if (context.repository) {
    const repoParts: string[] = [`Root: ${context.repository.root}`];
    if (context.repository.branch) repoParts.push(`Branch: ${context.repository.branch}`);
    if (context.repository.headSha) repoParts.push(`HEAD: ${context.repository.headSha}`);
    if (context.repository.workingTreeState) repoParts.push(`Working tree: ${context.repository.workingTreeState}`);
    if (context.repository.changedFiles && context.repository.changedFiles.length > 0) {
      repoParts.push(`Changed files:\n${context.repository.changedFiles.map((f) => `- ${f}`).join('\n')}`);
    }
    sections.push({ heading: 'Repository', content: repoParts.join('\n'), priority: 60 });
  }

  // L4 Continuity — if present.
  if (context.continuity) {
    const c = context.continuity;
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
      sections.push({ heading: 'Continuity', content: contParts.join('\n'), priority: 55 });
    }
  }

  // L5 Conversation — if present.
  if (context.conversation) {
    const convParts: string[] = [];
    if (context.conversation.sessionId) convParts.push(`Session: ${context.conversation.sessionId}`);
    if (context.conversation.parentSessionId) convParts.push(`Parent session: ${context.conversation.parentSessionId}`);
    if (context.conversation.messageHistory && context.conversation.messageHistory.length > 0) {
      convParts.push(`Message history (${context.conversation.messageHistory.length} messages):\n${context.conversation.messageHistory.join('\n')}`);
    }
    if (convParts.length > 0) {
      sections.push({ heading: 'Conversation', content: convParts.join('\n'), priority: 50 });
    }
  }

  // Build system prompt from ordered sections.
  const sorted = [...sections].sort((a, b) => b.priority - a.priority);
  const systemPrompt = sorted.map((s) => `## ${s.heading}\n${s.content}`).join('\n\n');

  return { systemPrompt, sections: sorted };
}
