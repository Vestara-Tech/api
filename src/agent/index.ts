export type {
  AgentRole,
  AgentModelPolicy,
  AgentRuntimePolicy,
  AgentInstructions,
  ToolSelector,
  SkillSelector,
  AgentExecutionPolicy,
  AgentDefinition,
  AgentRunStatus,
  AgentRun,
  AgentRunEvent,
  DelegationPolicy,
} from './domain/contracts.js';
export { AgentRegistry } from './registry/agent-registry.js';
export { BUILTIN_AGENTS } from './registry/builtin-agents.js';
export { AgentRunStateMachine } from './runtime/run-state-machine.js';
export type { AgentContextInput, AssembledAgentContext } from './context/context-assembler.js';
export { assembleAgentContext } from './context/context-assembler.js';
export type { AgentRunInput, AgentRuntimeOptions } from './runtime/agent-runtime.js';
export { AgentRuntime } from './runtime/agent-runtime.js';
export type { PendingApproval, ApprovalRuntimeOptions } from './approval/approval-runtime.js';
export { ApprovalRuntime } from './approval/approval-runtime.js';

// DEX-CP2 — Canonical execution context.
export type {
  AgentExecutionContext,
  AgentIdentityContext,
  ObjectiveContext,
  GovernanceContext,
  RepositoryContext,
  ContinuityContext,
  ConversationContext,
  ExecutionContextItem,
  ContextProvenance,
  ContextSource,
  ContextLayer,
  ContextSelectionMetadata,
  ResolvedExecutionSkill,
  ResolvedSkillResource,
} from './context/execution-context.js';
export type { ContextSelectionPolicy, ContextSelectionResult } from './context/context-selector.js';
export { selectContext } from './context/context-selector.js';
export type { ExecutionContextInput, ExecutionContextAssemblerDeps } from './context/execution-context-assembler.js';
export { ExecutionContextAssembler } from './context/execution-context-assembler.js';
export type { OpenCodeSerializedContext, OpenCodeContextSection } from './context/opencode-context-serializer.js';
export { serializeForOpenCode } from './context/opencode-context-serializer.js';
