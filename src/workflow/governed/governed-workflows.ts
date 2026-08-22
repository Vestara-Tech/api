/**
 * ARX-STAB-003 — Governed Activity Room workflows.
 *
 * Planner-first workflow templates the GovernedActivityRunner routes
 * STANDARD/COMPLEX goals through. The Workflow Runtime owns progression;
 * the Activity Room runner only orchestrates the routing decision.
 *
 *   STANDARD → vestara-governed-standard: plan → build → verify
 *   COMPLEX  → vestara-governed-complex:  plan → decompose → build → review → verify
 *
 * Agent objectives interpolate `{{goal}}` from the run inputs at runtime
 * (see WorkflowRuntime.runStep), so one registered definition serves every
 * goal without re-registering per execution.
 */

import type { CreateWorkflowInput, WorkflowStepDefinition } from '../domain/contracts.js';

export type GovernedWorkflowComplexity = 'standard' | 'complex';

export const GOVERNED_WORKFLOW_IDS: Record<GovernedWorkflowComplexity, string> = {
  standard: 'vestara-governed-standard',
  complex: 'vestara-governed-complex',
};

export function governedWorkflowId(complexity: GovernedWorkflowComplexity): string {
  return GOVERNED_WORKFLOW_IDS[complexity];
}

/** Build the governed workflow definition for a complexity level. */
export function buildGovernedWorkflow(complexity: GovernedWorkflowComplexity): CreateWorkflowInput {
  return {
    id: governedWorkflowId(complexity),
    name: complexity === 'complex' ? 'Vestara Governed Complex' : 'Vestara Governed Standard',
    version: '1.0.0',
    description: `Governed ${complexity} Activity Room execution: Planner-first progression through the Workflow Runtime.`,
    inputs: [
      { name: 'goal', type: 'string', required: true },
      { name: 'executionId', type: 'string', required: true },
      { name: 'principalId', type: 'string', required: false },
    ],
    steps: buildSteps(complexity),
  };
}

function buildSteps(complexity: GovernedWorkflowComplexity): readonly WorkflowStepDefinition[] {
  const plan: WorkflowStepDefinition = {
    id: 'plan',
    kind: 'agent',
    name: 'Plan',
    agent: { agentId: 'vestara-planner', objective: 'Plan {{goal}}', agentAssignmentId: 'planner-primary' },
  };

  if (complexity === 'standard') {
    return [
      plan,
      {
        id: 'build',
        kind: 'agent',
        name: 'Build',
        dependsOn: ['plan'],
        agent: { agentId: 'vestara-developer', objective: 'Build {{goal}}', agentAssignmentId: 'developer-primary' },
      },
      {
        id: 'verify',
        kind: 'agent',
        name: 'Verify',
        dependsOn: ['build'],
        agent: { agentId: 'vestara-verifier', objective: 'Verify {{goal}}', agentAssignmentId: 'verifier-primary' },
      },
    ];
  }

  return [
    plan,
    {
      id: 'decompose',
      kind: 'agent',
      name: 'Decompose',
      dependsOn: ['plan'],
      agent: { agentId: 'vestara-planner', objective: 'Decompose {{goal}} into milestones and tasks', agentAssignmentId: 'planner-decompose' },
    },
    {
      id: 'build',
      kind: 'agent',
      name: 'Build',
      dependsOn: ['decompose'],
      agent: { agentId: 'vestara-developer', objective: 'Build {{goal}}', agentAssignmentId: 'developer-primary' },
    },
    {
      id: 'review',
      kind: 'agent',
      name: 'Review',
      dependsOn: ['build'],
      agent: { agentId: 'vestara-reviewer', objective: 'Review {{goal}} implementation', agentAssignmentId: 'reviewer-primary' },
    },
    {
      id: 'verify',
      kind: 'agent',
      name: 'Verify',
      dependsOn: ['review'],
      agent: { agentId: 'vestara-verifier', objective: 'Verify {{goal}}', agentAssignmentId: 'verifier-primary' },
    },
  ];
}