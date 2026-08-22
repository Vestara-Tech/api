/**
 * ARX-CP2 ARX-014 — Governed Activity Room runner.
 *
 * The Activity Room's primary action boundary. Routes a goal through the
 * DEX complexity classification and launches the governed execution path:
 *
 *   SIMPLE/STANDARD → DeveloperExecutionCoordinator via a CAR-selected
 *                     runtime (OpenCode) — never the legacy AI model path.
 *   COMPLEX          → planning/workflow path. The developer coordinator is
 *                     NOT launched; orchestration continues from the plan.
 *
 * This runner owns the routing decision only. It does NOT invoke the AI
 * model-selection machinery (`AiService`, `ModelRouter`, agent-run LLM
 * generation) and has no dependency on the AI platform — by construction an
 * Activity Room goal can never trigger legacy AI model resolution.
 */

import type { AgentRegistry } from '../../agent/registry/agent-registry.js';
import type { CodingAgentRuntimeRegistry } from '../../car/registry/coding-agent-runtime-registry.js';
import { RuntimeSelector } from '../../car/runtime/runtime-selector.js';
import { DeveloperExecutionCoordinator, type DeveloperExecutionResult } from '../../car/runtime/developer-execution-coordinator.js';
import type { ExecutionService } from '../../execution/index.js';
import type { CodingExecutionEvidenceStore } from '../../car/evidence/contracts.js';
import type { WorkflowService } from '../../workflow/index.js';
import type { ActivityHistoryRecorder } from '../history/recorder.js';
import type { ActivityHistoryStore } from '../history/contracts.js';
import type { CoordinatorResult } from '../projection/execution-projection.js';

export type GovernedActivityRoute = 'developer' | 'workflow';

export interface GovernedActivityStartInput {
  readonly goal: string;
  readonly principalId?: string;
}

export interface GovernedActivityStartResult {
  readonly executionId: string;
  readonly complexity: 'simple' | 'standard' | 'complex';
  readonly route: GovernedActivityRoute;
  readonly status: string;
  readonly workflowId?: string;
  readonly workflowRunId?: string;
}

export interface GovernedActivityRunnerDeps {
  readonly execution: ExecutionService;
  readonly recorder: ActivityHistoryRecorder;
  readonly history: ActivityHistoryStore;
  readonly workflow: WorkflowService;
  readonly agents: AgentRegistry;
  readonly selector: RuntimeSelector;
  readonly registry: CodingAgentRuntimeRegistry;
  readonly coordinator: DeveloperExecutionCoordinator;
  readonly evidence: CodingExecutionEvidenceStore;
}

export class GovernedActivityRunner {
  constructor(private readonly deps: GovernedActivityRunnerDeps) {}

  /**
   * ARX-014/ARX-STAB-003 — Start a governed Activity Room execution.
   *
   * Preview (complexity classification) is synchronous. The routing decision:
   *
   *   SIMPLE   → developer route via a CAR-selected runtime (DEX/OpenCode).
   *   STANDARD → governed workflow route (vestara-governed-standard:
   *              Planner → Developer → Verifier) — NOT the COMPLEX pipeline.
   *   COMPLEX  → governed workflow route (vestara-governed-complex:
   *              Planner → Decompose → Developer → Reviewer → Verifier).
   *
   * The workflow run starts synchronously (the run object is returned
   * immediately; the runtime dispatches progression). Failures surface
   * through durable history facts + the execution record.
   */
  async start(input: GovernedActivityStartInput): Promise<GovernedActivityStartResult> {
    const plan = this.deps.execution.preview({
      goal: input.goal,
      agentId: 'vestara-developer',
      roomId: 'activity-room',
      ...(input.principalId !== undefined ? { principalId: input.principalId } : {}),
    });

    const executionId = plan.executionId;
    const complexity = plan.intent.complexity;

    // ARX-STAB-003 — Idempotency must be checked BEFORE recordExecution, which
    // would otherwise overwrite the persisted workflowRunId correlation with a
    // fresh fact and allow a duplicate workflow run on a retried start.
    if (complexity === 'complex' || complexity === 'standard') {
      const existingFact = this.deps.history.getExecution(executionId);
      if (existingFact?.workflowRunId !== undefined) {
        return this.existingWorkflowResult(executionId, complexity, existingFact);
      }
    }

    const draft = this.deps.execution.get(executionId);
    if (draft) {
      this.deps.recorder.recordExecution({ execution: draft });
    }

    if (complexity === 'complex' || complexity === 'standard') {
      return this.startWorkflow(executionId, complexity, input, draft);
    }

    // SIMPLE → governed developer execution via CAR.
    this.deps.execution.start(executionId);
    void this.executeDeveloper(plan.executionId, input.goal, input.principalId);

    return { executionId, complexity, route: 'developer', status: 'running' };
  }

  /**
   * ARX-STAB-003 — Start a real governed workflow run for STANDARD/COMPLEX.
   * Idempotent: a retried/duplicate start reuses the existing correlation
   * instead of creating a second workflow run.
   */
  private startWorkflow(
    executionId: string,
    complexity: 'standard' | 'complex',
    input: GovernedActivityStartInput,
    draft: NonNullable<ReturnType<ExecutionService['get']>> | null,
  ): GovernedActivityStartResult {
    // Idempotency: reuse an existing workflow correlation for this execution.
    const existingFact = this.deps.history.getExecution(executionId);
    if (existingFact?.workflowRunId !== undefined) {
      return this.existingWorkflowResult(executionId, complexity, existingFact);
    }

    if (!draft) {
      return { executionId, complexity, route: 'workflow', status: 'failed' };
    }

    try {
      const run = this.deps.workflow.startGoverned({
        executionId,
        goal: input.goal,
        complexity,
        ...(input.principalId !== undefined ? { principalId: input.principalId } : {}),
      });
      this.deps.execution.start(executionId);
      this.deps.recorder.recordWorkflowStart({
        execution: draft,
        workflowId: run.workflowId,
        workflowRunId: run.id,
      });
      return {
        executionId,
        complexity,
        route: 'workflow',
        status: run.status,
        workflowId: run.workflowId,
        workflowRunId: run.id,
      };
    } catch (error) {
      this.deps.execution.complete(executionId, { status: 'failed', result: 'indeterminate' });
      this.deps.recorder.recordWorkflowFailure({
        execution: draft,
        workflowId: complexity === 'complex' ? 'vestara-governed-complex' : 'vestara-governed-standard',
        workflowRunId: '',
        error: (error as Error).message,
      });
      return { executionId, complexity, route: 'workflow', status: 'failed' };
    }
  }

  private existingWorkflowResult(
    executionId: string,
    complexity: 'standard' | 'complex',
    fact: NonNullable<ReturnType<ActivityHistoryStore['getExecution']>>,
  ): GovernedActivityStartResult {
    const workflowRunId = fact.workflowRunId;
    if (workflowRunId === undefined) {
      return { executionId, complexity, route: 'workflow', status: fact.status };
    }
    try {
      const run = this.deps.workflow.getRun(workflowRunId);
      return {
        executionId,
        complexity,
        route: 'workflow',
        status: run.status,
        workflowId: run.workflowId,
        workflowRunId: run.id,
      };
    } catch {
      // The workflow runtime is in-memory; after a restart the run object is
      // gone but the correlation is authoritative. Do not create a duplicate.
      return {
        executionId,
        complexity,
        route: 'workflow',
        status: fact.status,
        ...(fact.workflowId !== undefined ? { workflowId: fact.workflowId } : {}),
        workflowRunId,
      };
    }
  }

  private async executeDeveloper(executionId: string, goal: string, principalId: string | undefined): Promise<void> {
    const startedAt = new Date().toISOString();
    try {
      const agent = this.deps.agents.get('vestara-developer');
      const selected = await this.deps.selector.select(agent.runtimePolicy ?? { runtime: 'auto' });
      const adapter = this.deps.registry.get(selected.runtimeId);

      const result = await this.deps.coordinator.execute(
        {
          executionId,
          agentId: 'vestara-developer',
          goal,
          roomId: 'activity-room',
          ...(principalId !== undefined ? { principalId } : {}),
          repository: { root: process.cwd() },
        },
        adapter,
      );

      const completedAt = new Date().toISOString();
      const draft = this.deps.execution.get(executionId);
      if (draft) {
        this.deps.recorder.recordCoordinatorResult({
          execution: draft,
          result: toCoordinatorResult(result, startedAt, completedAt),
        });
      }
      if (result.evidence) {
        await this.deps.evidence.save(result.evidence);
      }
      this.deps.execution.complete(executionId, {
        status: result.outcome === 'completed' ? 'completed' : result.outcome === 'cancelled' ? 'cancelled' : 'failed',
        result: result.verification.conclusion,
        ...(result.evidence !== undefined ? { evidence: result.evidence.evidenceHash } : {}),
      });
    } catch (error) {
      this.deps.execution.complete(executionId, {
        status: 'failed',
        result: 'indeterminate',
        ...((error as Error).message !== undefined ? { evidence: null } : {}),
      });
    }
  }
}

function toCoordinatorResult(
  result: DeveloperExecutionResult,
  startedAt: string,
  completedAt: string,
): CoordinatorResult {
  const events = result.events.map((event, index) => {
    const at = interpolateAt(startedAt, completedAt, index, result.events.length);
    return { ...event, at };
  });

  return {
    executionId: result.executionId,
    agentId: result.agentId,
    outcome: result.outcome,
    runtimeId: result.runtimeId,
    ...(result.sessionId !== undefined ? { sessionId: result.sessionId } : {}),
    ...(result.runtimeModel !== undefined ? { runtimeModel: result.runtimeModel } : {}),
    changedFiles: result.changedFiles,
    verification: {
      conclusion: result.verification.conclusion,
      freshness: result.verification.freshness,
      ...(result.verification.level !== undefined ? { level: result.verification.level } : {}),
      ...(result.verification.affectedModules !== undefined && result.verification.affectedModules.length > 0
        ? { affectedModules: result.verification.affectedModules }
        : {}),
      ...(result.verification.fingerprint !== undefined ? { fingerprint: result.verification.fingerprint } : {}),
      ...(result.verification.reasons !== undefined && result.verification.reasons.length > 0
        ? { reasons: result.verification.reasons }
        : {}),
    },
    handoffEligible: result.handoffEligible,
    ...(result.evidence !== undefined
      ? {
          evidence: {
            evidenceHash: result.evidence.evidenceHash,
            outcome: result.evidence.outcome,
            skills: result.evidence.skills,
            tools: result.evidence.tools,
          },
        }
      : {}),
    events,
  };
}

function interpolateAt(startedAt: string, completedAt: string, index: number, total: number): string {
  if (total <= 1) return completedAt;
  const start = Date.parse(startedAt);
  const span = Math.max(0, Date.parse(completedAt) - start);
  const offset = Math.round((span * index) / (total - 1));
  return new Date(start + offset).toISOString();
}