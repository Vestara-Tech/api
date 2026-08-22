import type { AgentRegistry } from '../../agent/registry/agent-registry.js';
import type { SkillRegistry } from '../../skill/registry/skill-registry.js';
import type { SkillResolver } from '../../skill/resolver/skill-resolver.js';
import { ExecutionContextAssembler } from '../../agent/context/execution-context-assembler.js';
import type { AgentExecutionContext } from '../../agent/context/execution-context.js';
import type { CodingAgentRuntime, CodingAgentEvent, CodingAgentSession } from '../domain/contracts.js';
import type {
  VerificationRequest,
  VerificationVerdict,
} from '../../verification/domain/contracts.js';
import type { VerificationControlPlane } from '../../verification/domain/contracts.js';
import type { RuntimeSessionRegistry, WorkflowSessionContext } from './runtime-session-registry.js';
import { CapacityExhaustedError } from './runtime-session-registry.js';
import {
  buildCodingExecutionEvidence,
} from '../evidence/builder.js';
import type {
  CodingExecutionEvidence,
  CodingExecutionEvidenceInput,
} from '../evidence/contracts.js';

/** DEX-CP6 — Input for developer execution. */
export interface DeveloperExecutionRequest {
  readonly executionId: string;
  readonly agentId: string;
  readonly goal: string;
  readonly roomId: string;
  readonly principalId?: string;
  readonly repository?: {
    readonly root?: string;
    readonly branch?: string;
    readonly headSha?: string;
  };
  /** ARX-014 — Workflow context for session binding. When provided, the session
   *  is keyed by (workflowRunId, agentAssignmentId, runtimeId) instead of
   *  (executionId, agentRunId). */
  readonly workflowContext?: WorkflowSessionContext;
}

/** DEX-CP6 — Output of developer execution. */
export interface DeveloperExecutionResult {
  readonly executionId: string;
  readonly agentId: string;
  readonly outcome: 'completed' | 'failed' | 'cancelled' | 'blocked';
  readonly context: AgentExecutionContext;
  readonly runtimeId: string;
  readonly sessionId?: string;
  readonly runtimeModel?: string;
  readonly changedFiles: readonly string[];
  readonly verification: VerificationVerdict;
  readonly handoffEligible: boolean;
  readonly evidence?: CodingExecutionEvidence;
  readonly events: readonly CodingAgentEvent[];
  readonly error?: string;
}

/** DEX-CP6 — Coordinator dependencies. */
export interface DeveloperExecutionCoordinatorDeps {
  readonly agents: AgentRegistry;
  readonly skillRegistry: SkillRegistry;
  readonly skillResolver: SkillResolver;
  readonly verification: VerificationControlPlane;
  /** DEX-CP3.1 — Session ownership above the adapter. */
  readonly sessions: RuntimeSessionRegistry;
  /** Bounded verification-fix iterations that reuse the same CAR session. */
  readonly maxFixAttempts?: number;
}

/**
 * DEX-CP6 CP6.2 — Developer execution coordinator.
 *
 * Orchestrates the full execution lifecycle:
 *   resolve agent → resolve skills → assemble context →
 *   execute via CAR → verify → produce evidence → result
 *
 * Owns the sequence. Does NOT own skill resolution, context selection,
 * coding implementation, permissions, verification policy, or evidence hashing.
 */
export class DeveloperExecutionCoordinator {
  private readonly deps: DeveloperExecutionCoordinatorDeps;

  constructor(deps: DeveloperExecutionCoordinatorDeps) {
    this.deps = deps;
  }

  /**
   * Execute a developer task through the full governed pipeline.
   *
   * The adapter is injected externally — the coordinator does not
   * select or create CAR adapters.
   */
  async execute(
    request: DeveloperExecutionRequest,
    adapter: CodingAgentRuntime,
  ): Promise<DeveloperExecutionResult> {
    const startedAt = new Date().toISOString();
    const agentRunId = request.executionId;

    try {
      // 1. Resolve agent.
      const agent = this.deps.agents.get(request.agentId);

      // 2. Assemble context via CP2.
      const assembler = new ExecutionContextAssembler({
        skillRegistry: this.deps.skillRegistry,
        skillResolver: this.deps.skillResolver,
      });

      const run = { id: request.executionId, agentId: agent.id, status: 'running' as const };
      const contextInput: import('../../agent/context/execution-context-assembler.js').ExecutionContextInput = {
        agent,
        run,
        goal: request.goal,
        toolDescriptions: agent.tools.map((t) => t.id),
        ...(request.repository?.root !== undefined ? {
          repository: {
            root: request.repository.root,
            ...(request.repository.branch !== undefined ? { branch: request.repository.branch } : {}),
            ...(request.repository.headSha !== undefined ? { headSha: request.repository.headSha } : {}),
          },
        } : {}),
      };
      const context = await assembler.assemble(contextInput);

      // 3. DEX-CP3.1 / ARX-014 — Session ownership above the adapter. One Developer
      // execution/workflow-assignment owns one CAR session: the registry resumes an
      // existing binding instead of recreating a session for every step/retry.
      //
      // Workflow path: keyed by (workflowRunId, agentAssignmentId, runtimeId)
      // DEX path:      keyed by (executionId, agentRunId)
      const wc = request.workflowContext;
      const events: CodingAgentEvent[] = [];
      if (wc !== undefined) {
        events.push({ type: 'runtime-session-requested', workflowRunId: wc.workflowRunId, agentAssignmentId: wc.agentAssignmentId, runtimeId: wc.runtimeId });
      }

      let session: CodingAgentSession | undefined;
      const acquired = await this.deps.sessions.getOrCreate(
        request.executionId,
        agentRunId,
        {
          runtime: adapter.id,
          create: async () => {
            const created = await adapter.createSession({
              agentId: context.identity.agentId,
              runId: context.identity.runId,
              objective: context.objective.goal ?? '',
              systemPrompt: context.governance.systemInstructions,
              ...(request.repository?.root !== undefined ? { workspace: request.repository.root } : {}),
            });
            session = created;
            return { sessionId: created.id, providerSessionId: created.providerSessionId };
          },
        },
        (sessionId) => adapter.close(sessionId),
        request.workflowContext,
      );
      if (!acquired.created) {
        session = await adapter.resumeSession(acquired.binding.sessionId);
        events.push({ type: 'session-resumed', sessionId: session.id });
        if (wc !== undefined) {
          events.push({ type: 'runtime-session-reused', sessionId: session.id, workflowRunId: wc.workflowRunId, agentAssignmentId: wc.agentAssignmentId, uses: acquired.binding.uses });
        }
      } else {
        events.push({
          type: 'session-created',
          sessionId: session!.id,
          runtime: adapter.id,
          ...(session!.model !== undefined ? { model: session!.model } : {}),
        });
      }
      if (session === undefined) {
        throw new Error('Developer runtime session could not be established');
      }

      // 4. Execute → verify → (bounded fix loop reusing the SAME session).
      const maxFixAttempts = this.deps.maxFixAttempts ?? 1;
      let verification: VerificationVerdict | undefined;
      let changedFiles: string[] = [];
      let fixAttempt = 0;

      for (;;) {
        const prompt = fixAttempt === 0 ? request.goal : this.buildFixPrompt(request.goal, verification as VerificationVerdict, changedFiles);
        for await (const event of adapter.execute(session, { prompt })) {
          events.push(event);
        }

        changedFiles = this.extractChangedFiles(events);
        verification = await this.deps.verification.verify({
          purpose: 'developer-handoff',
          executionId: request.executionId,
          agentRunId,
          repositoryRoot: request.repository?.root ?? process.cwd(),
          changedFiles,
        });

        const handoffEligible = verification.conclusion === 'pass' && verification.freshness === 'current';
        if (handoffEligible) break;
        // Only actionable failures (repo mutated) justify a fix iteration.
        if (verification.conclusion !== 'fail' || changedFiles.length === 0) break;
        if (fixAttempt >= maxFixAttempts) break;

        // Reuse the owned session for the fix — never create a second one.
        const resumed = await this.deps.sessions.getOrCreate(request.executionId, agentRunId, {
          runtime: adapter.id,
          create: async () => {
            throw new Error('Unreachable: an active binding must be resumed, not created');
          },
        }, undefined, request.workflowContext);
        if (!resumed.created) {
          session = await adapter.resumeSession(resumed.binding.sessionId);
        }
        events.push({ type: 'session-resumed', sessionId: session.id });
        if (wc !== undefined) {
          events.push({ type: 'runtime-session-reused', sessionId: session.id, workflowRunId: wc.workflowRunId, agentAssignmentId: wc.agentAssignmentId, uses: resumed.binding.uses });
        }
        fixAttempt += 1;
      }

      const completedAt = new Date().toISOString();
      if (verification === undefined) {
        throw new Error('Developer execution produced no verification verdict');
      }

      // 5. Build evidence.
      const evidenceInput: CodingExecutionEvidenceInput = {
        outcome: 'completed',
        execution: {
          executionId: request.executionId,
          agentRunId,
          objective: request.goal,
        },
        agent: { id: agent.id, role: agent.role },
        runtime: {
          id: adapter.id,
          sessionId: session.id,
        },
        ...(session.model !== undefined
          ? {
              model: {
                providerId: adapter.id,
                modelId: session.model.split('/').pop() ?? session.model,
              },
            }
          : {}),
        repository: {
          baselineSha: request.repository?.headSha,
          changedFiles,
        },
        skills: context.governance.skills.map((s) => ({ id: s.id, version: s.version })),
        tools: agent.tools.map((t) => ({
          id: t.id,
          granted: true,
          used: events.some((e) => e.type === 'tool-completed' && 'name' in e && e.name === t.id),
        })),
        verification: {
          purpose: verification.purpose,
          conclusion: verification.conclusion,
          freshness: verification.freshness,
          fingerprint: verification.fingerprint,
          sourceEvidence: verification.sources.map((s) => s.sourceId),
        },
        timing: { startedAt, completedAt },
      };

      const evidence = buildCodingExecutionEvidence(evidenceInput);
      this.deps.sessions.complete(request.executionId, agentRunId);

      return {
        executionId: request.executionId,
        agentId: agent.id,
        outcome: 'completed',
        context,
        runtimeId: adapter.id,
        sessionId: session.id,
        ...(session.model !== undefined ? { runtimeModel: session.model } : {}),
        changedFiles,
        verification,
        handoffEligible: verification.conclusion === 'pass' && verification.freshness === 'current',
        evidence,
        events,
      };
    } catch (error) {
      // ARX-014 — Capacity exhaustion is a governed state, not a failure.
      // Re-throw so the AgentStepExecutor can convert it to outcome: 'queued'.
      if (error instanceof CapacityExhaustedError) {
        throw error;
      }

      const completedAt = new Date().toISOString();
      this.deps.sessions.fail(request.executionId, agentRunId);

      // Build failure evidence.
      const failedEvidence = this.buildFailureEvidence(request, startedAt, completedAt, error);

      return {
        executionId: request.executionId,
        agentId: request.agentId,
        outcome: 'failed',
        context: {} as AgentExecutionContext,
        runtimeId: adapter.id,
        changedFiles: [],
        verification: {
          purpose: 'developer-handoff',
          conclusion: 'indeterminate',
          freshness: 'current',
          level: 'V0',
          affectedModules: [],
          requiredEvidence: [],
          satisfiedEvidence: [],
          missingEvidence: ['verification-report'],
          sources: [],
          reasons: [{ kind: 'infrastructure-failure', message: (error as Error).message }],
        },
        handoffEligible: false,
        evidence: failedEvidence,
        events: [],
        error: (error as Error).message,
      };
    }
  }

  private buildFixPrompt(goal: string, verification: VerificationVerdict, changedFiles: readonly string[]): string {
    const reasons = (verification.reasons ?? []).map((r) => r.message).join('; ');
    const files = changedFiles.length > 0 ? `\nChanged files:\n${changedFiles.map((f) => `- ${f}`).join('\n')}` : '';
    return `Verification failed for "${goal}". Reason: ${reasons || verification.conclusion}.${files}\nPlease fix the implementation so it passes verification.`;
  }

  private extractChangedFiles(events: readonly CodingAgentEvent[]): string[] {
    const files = new Set<string>();
    for (const event of events) {
      if (event.type === 'file-changed' && 'path' in event) {
        files.add(event.path);
      }
    }
    return [...files].sort();
  }

  private buildFailureEvidence(
    request: DeveloperExecutionRequest,
    startedAt: string,
    completedAt: string,
    error: unknown,
  ): CodingExecutionEvidence {
    return buildCodingExecutionEvidence({
      outcome: 'failed',
      execution: {
        executionId: request.executionId,
        agentRunId: request.executionId,
        objective: request.goal,
      },
      agent: { id: request.agentId, role: 'developer' },
      runtime: { id: 'unknown' },
      repository: { changedFiles: [] },
      verification: {
        purpose: 'developer-handoff',
        conclusion: 'indeterminate',
        freshness: 'current',
      },
      timing: { startedAt, completedAt },
    });
  }
}
