import type { AgentDefinition } from '../domain/contracts.js';

const DEFAULT_EXECUTION = {
  maxSteps: 40,
  maxToolCalls: 25,
  allowDelegation: true,
  maxConcurrentChildren: 3,
  maxDepth: 4,
};

/**
 * AGENT-019..023 (definitions) — the canonical built-in agents. Specialists are
 * composed from these plus skills, not duplicated as near-identical agents.
 */
export const BUILTIN_AGENTS: readonly AgentDefinition[] = [
  {
    id: 'vestara-planner',
    version: '1.0.0',
    name: 'Planner',
    role: 'planner',
    model: { mode: 'auto', requirements: { reasoning: true, tools: true, structuredOutput: true }, optimizeFor: 'quality' },
    instructions: {
      system: 'You are the Vestara planner. Break work into an ordered plan, assign tasks to agents, and keep the plan observable.',
      guardrails: ['Never execute mutations; produce plans and delegate.'],
    },
    tools: [{ id: 'agent.delegate' }, { id: 'agent.status' }],
    skills: [{ id: 'vestara-planning' }],
    permissions: ['workflow.plan', 'agent.delegate'],
    execution: DEFAULT_EXECUTION,
  },
  {
    id: 'vestara-developer',
    version: '1.0.0',
    name: 'Developer',
    role: 'developer',
    model: { mode: 'auto', requirements: { tools: true, structuredOutput: true }, optimizeFor: 'balanced' },
    instructions: {
      system: 'You are the Vestara developer. Use provided tools to implement capabilities and run verifications.',
      guardrails: ['Generated artifacts are proposals; apply through governed apply only.'],
    },
    tools: [
      { id: 'api.definition.read' },
      { id: 'api.definition.get' },
      { id: 'api.definition.create' },
      { id: 'api.definition.validate' },
      { id: 'api.definition.preview' },
    ],
    skills: [
      { id: 'vestara-api-builder' },
      { id: 'typescript-development' },
      { id: 'testing' },
    ],
    permissions: ['builder.definition.read', 'builder.definition.create', 'builder.definition.validate', 'builder.definition.preview'],
    execution: DEFAULT_EXECUTION,
  },
  {
    id: 'vestara-reviewer',
    version: '1.0.0',
    name: 'Reviewer',
    role: 'reviewer',
    model: { mode: 'auto', requirements: { reasoning: true, structuredOutput: true }, optimizeFor: 'quality' },
    instructions: {
      system: 'You are the Vestara reviewer. Review implementations for correctness, security and style; never modify code.',
      guardrails: ['Read-only. Recommend changes, do not apply them.'],
    },
    tools: [{ id: 'api.definition.read' }, { id: 'api.definition.get' }, { id: 'api.definition.preview' }],
    skills: [{ id: 'vestara-code-review' }],
    permissions: ['builder.definition.read'],
    execution: { ...DEFAULT_EXECUTION, allowDelegation: false },
  },
  {
    id: 'vestara-verifier',
    version: '1.0.0',
    name: 'Verifier',
    role: 'verifier',
    model: { mode: 'auto', requirements: { reasoning: true, structuredOutput: true }, optimizeFor: 'quality' },
    instructions: {
      system: 'You are the Vestara verifier. Prove correctness via evidence; never think, never review.',
      guardrails: ['Only accept verifiable evidence.'],
    },
    tools: [{ id: 'api.definition.preview' }],
    skills: [{ id: 'vestara-verification' }],
    permissions: ['builder.definition.read'],
    execution: { ...DEFAULT_EXECUTION, allowDelegation: false },
  },
  {
    id: 'vestara-observer',
    version: '1.0.0',
    name: 'Observer',
    role: 'observer',
    model: { mode: 'auto', requirements: { tools: true }, optimizeFor: 'balanced' },
    instructions: {
      system: 'You are the Vestara observer. Analyze workflow state, detect blockers, and recommend continue/blocked/needs-review. The workflow state machine remains authoritative.',
      guardrails: ['Never declare work complete; recommend only.'],
    },
    tools: [{ id: 'api.definition.read' }],
    skills: [],
    permissions: ['workflow.observe', 'builder.definition.read'],
    execution: { ...DEFAULT_EXECUTION, allowDelegation: false },
  },
];
