import type { WorkflowRun } from '../../workflow/domain/contracts.js';
import type { ContextCollectionRequest, ContextItem } from '../domain/contracts.js';
import type { ContextProvider } from './context-provider.js';

/**
 * CTX-016 — Workflow context provider. Supplies the current workflow run state
 * so an agent knows its stage, waiting state and step results.
 */
export class WorkflowContextProvider implements ContextProvider {
  readonly id = 'workflow';
  readonly kinds = ['workflow'] as const;
  readonly scope = 'workflow';

  constructor(private readonly getRun: (runId: string) => WorkflowRun | undefined) {}

  async collect(request: ContextCollectionRequest): Promise<readonly ContextItem[]> {
    if (!request.workflowRunId) return [];
    const run = this.getRun(request.workflowRunId);
    if (!run) return [];
    const stepSummary = run.steps.map((s) => `${s.stepId}:${s.status}`).join(', ');
    return [
      {
        id: `workflow:${run.id}`,
        source: 'workflow',
        sourceId: run.id,
        title: 'Current Workflow',
        content: `Workflow ${run.workflowId}@${run.version} (${run.status})\nSteps: ${stepSummary}`,
        priority: 70,
        required: true,
        sensitive: false,
        metadata: { scope: 'workflow', status: run.status },
      },
    ];
  }
}
