import type {
  CreateWorkflowInput,
  WorkflowDefinition,
  WorkflowRun,
} from '../domain/contracts.js';
import { buildGovernedWorkflow, governedWorkflowId, type GovernedWorkflowComplexity } from '../governed/governed-workflows.js';
import { WorkflowRegistry } from '../registry/workflow-registry.js';
import { WorkflowRuntime } from '../runtime/workflow-runtime.js';

export interface WorkflowServiceOptions {
  readonly registry: WorkflowRegistry;
  readonly runtime: WorkflowRuntime;
}

export interface GovernedWorkflowStartInput {
  readonly executionId: string;
  readonly goal: string;
  readonly complexity: GovernedWorkflowComplexity;
  readonly principalId?: string;
}

export interface WorkflowService {
  create(input: CreateWorkflowInput): WorkflowDefinition;
  get(id: string): WorkflowDefinition;
  has(id: string): boolean;
  list(): readonly WorkflowDefinition[];
  publish(id: string): WorkflowDefinition;
  start(workflowId: string, inputs?: Readonly<Record<string, unknown>>): WorkflowRun;
  startGoverned(input: GovernedWorkflowStartInput): WorkflowRun;
  listRuns(workflowId?: string): readonly WorkflowRun[];
  getRun(id: string): WorkflowRun;
  cancel(runId: string): WorkflowRun;
  resume(runId: string): WorkflowRun;
  retry(runId: string): WorkflowRun;
}

/**
 * WF-001/015 — Workflow service facade. Thin, testable boundary over the
 * registry (definitions + revisions) and the runtime (durable runs).
 */
export class WorkflowService implements WorkflowService {
  private readonly registry: WorkflowRegistry;
  private readonly runtime: WorkflowRuntime;

  constructor(options: WorkflowServiceOptions) {
    this.registry = options.registry;
    this.runtime = options.runtime;
  }

  create(input: CreateWorkflowInput): WorkflowDefinition {
    return this.registry.register({
      id: input.id,
      name: input.name,
      version: input.version,
      ...(input.description !== undefined ? { description: input.description } : {}),
      inputs: input.inputs ?? [],
      variables: input.variables ?? [],
      triggers: input.triggers ?? [],
      steps: input.steps,
      ...(input.outputs !== undefined ? { outputs: input.outputs } : {}),
      status: 'draft',
      revision: 0,
    });
  }

  get(id: string): WorkflowDefinition {
    return this.registry.get(id);
  }

  has(id: string): boolean {
    return this.registry.has(id);
  }

  list(): readonly WorkflowDefinition[] {
    return this.registry.list();
  }

  publish(id: string): WorkflowDefinition {
    return this.registry.publish(id);
  }

  start(workflowId: string, inputs: Readonly<Record<string, unknown>> = {}): WorkflowRun {
    return this.runtime.start(workflowId, inputs);
  }

  /**
   * ARX-STAB-003 — Start a governed Activity Room workflow run.
   * Ensures the Planner-first governed workflow definition is registered
   * (idempotent), then starts a run with the execution context as inputs so
   * agent objectives can interpolate `{{goal}}`.
   */
  startGoverned(input: GovernedWorkflowStartInput): WorkflowRun {
    const workflowId = governedWorkflowId(input.complexity);
    if (!this.has(workflowId)) {
      this.create(buildGovernedWorkflow(input.complexity));
      this.publish(workflowId);
    }
    return this.start(workflowId, {
      goal: input.goal,
      executionId: input.executionId,
      ...(input.principalId !== undefined ? { principalId: input.principalId } : {}),
    });
  }

  listRuns(workflowId?: string): readonly WorkflowRun[] {
    return this.runtime.listRuns(workflowId);
  }

  getRun(id: string): WorkflowRun {
    return this.runtime.getRun(id);
  }

  cancel(runId: string): WorkflowRun {
    return this.runtime.cancel(runId);
  }

  resume(runId: string): WorkflowRun {
    return this.runtime.resume(runId);
  }

  retry(runId: string): WorkflowRun {
    return this.runtime.retry(runId);
  }
}
