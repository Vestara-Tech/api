/**
 * DEX-CP2 — Canonical execution context contracts.
 *
 * These types are runtime-neutral: no @opencode-ai/sdk types, no
 * runtime-specific formatting. Runtime adapters consume these through
 * serializers (CTX-010).
 */

// ── Context Layers (L0–L5) ─────────────────────────────────────────

/** L0 — Agent identity. Who is executing. */
export interface AgentIdentityContext {
  readonly agentId: string;
  readonly agentVersion: string;
  readonly agentName: string;
  readonly role: string;
  readonly runId: string;
}

/** L1 — Objective. What the agent is trying to achieve. */
export interface ObjectiveContext {
  readonly goal?: string | undefined;
  readonly task?: string | undefined;
  readonly acceptanceCriteria?: readonly string[] | undefined;
  readonly constraints?: readonly string[] | undefined;
  readonly workflowStep?: string | undefined;
}

/** L2 — Governance. Rules, skills, tools, permissions. */
export interface GovernanceContext {
  readonly systemInstructions: string;
  readonly guardrails: readonly string[];
  readonly skills: readonly ResolvedExecutionSkill[];
  readonly toolDescriptions: readonly string[];
  readonly permissions: readonly string[];
}

/** L3 — Repository. Where the agent is working. */
export interface RepositoryContext {
  readonly root: string;
  readonly branch?: string;
  readonly headSha?: string;
  readonly workingTreeState?: 'clean' | 'dirty';
  readonly changedFiles?: readonly string[];
  readonly relevantFiles?: readonly string[];
}

/** L4 — Continuity. Multi-agent/multi-step coherence. */
export interface ContinuityContext {
  readonly workflowId?: string;
  readonly currentMilestone?: string;
  readonly currentTask?: string;
  readonly completedPredecessors?: readonly string[];
  readonly plannerOutput?: string;
  readonly previousIteration?: string;
  readonly reviewerFeedback?: string;
}

/** L5 — Conversation. Current conversation/session state. */
export interface ConversationContext {
  readonly sessionId?: string;
  readonly parentSessionId?: string;
  readonly messageHistory?: readonly string[];
}

// ── Resolved skill (re-exported from CP1 for convenience) ──────────

export interface ResolvedExecutionSkill {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly instructions: string;
  readonly resources: readonly ResolvedSkillResource[];
  readonly roleCompatible: boolean;
  readonly missingRequired: readonly string[];
  readonly matchedOptional: readonly string[];
  readonly optional: boolean;
}

export interface ResolvedSkillResource {
  readonly path: string;
  readonly kind: 'markdown' | 'template' | 'example' | 'reference';
  readonly content?: string;
}

// ── Context Item & Provenance (CTX-002) ───────────────────────────

export type ContextSource =
  | 'agent-definition'
  | 'skill-registry'
  | 'tool-registry'
  | 'repository'
  | 'workflow'
  | 'caller'
  | 'module';

export type ContextLayer =
  | 'identity'
  | 'objective'
  | 'governance'
  | 'repository'
  | 'continuity'
  | 'conversation';

/** A single piece of context with provenance. */
export interface ExecutionContextItem {
  readonly id: string;
  readonly source: ContextSource;
  readonly layer: ContextLayer;
  readonly required: boolean;
  readonly priority: number;
  readonly content: string;
  readonly estimatedTokens: number;
  readonly provenance: ContextProvenance;
}

export interface ContextProvenance {
  readonly source: ContextSource;
  readonly resolvedAt: string;
  readonly skillId?: string;
  readonly version?: string;
  readonly description?: string;
}

// ── Selection Metadata ─────────────────────────────────────────────

export interface ContextSelectionMetadata {
  readonly totalItems: number;
  readonly selectedItems: number;
  readonly totalEstimatedTokens: number;
  readonly budgetTokens: number;
  readonly droppedItems: readonly string[];
  readonly requiredDropped: readonly string[];
  readonly resolvedAt: string;
}

// ── Canonical Execution Context (CTX-001) ──────────────────────────

export interface AgentExecutionContext {
  readonly identity: AgentIdentityContext;
  readonly objective: ObjectiveContext;
  readonly governance: GovernanceContext;
  readonly repository?: RepositoryContext | undefined;
  readonly continuity?: ContinuityContext | undefined;
  readonly conversation?: ConversationContext | undefined;
  readonly selection: ContextSelectionMetadata;
}
