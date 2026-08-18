import type { AgentRegistry } from '../../agent/registry/agent-registry.js';
import type { SkillRegistry } from '../../skill/registry/skill-registry.js';
import type { SkillResolver } from '../../skill/resolver/skill-resolver.js';
import { ExecutionContextAssembler } from '../../agent/context/execution-context-assembler.js';
import type { AgentExecutionContext } from '../../agent/context/execution-context.js';
import type { CodingAgentRuntime, CodingAgentEvent } from '../domain/contracts.js';
import type {
  VerificationRequest,
  VerificationVerdict,
} from '../../verification/domain/contracts.js';
import type { VerificationControlPlane } from '../../verification/domain/contracts.js';
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
}

/** DEX-CP6 — Output of developer execution. */
export interface DeveloperExecutionResult {
  readonly executionId: string;
  readonly agentId: string;
  readonly outcome: 'completed' | 'failed' | 'cancelled' | 'blocked';
  readonly context: AgentExecutionContext;
  readonly runtimeId: string;
  readonly sessionId?: string;
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

      // 3. Create session and execute via adapter.
      const session = await adapter.createSession({
        agentId: context.identity.agentId,
        runId: context.identity.runId,
        objective: context.objective.goal ?? '',
        systemPrompt: context.governance.systemInstructions,
        workspace: request.repository?.root,
      });

      const events: CodingAgentEvent[] = [];
      for await (const event of adapter.execute(session, { prompt: request.goal })) {
        events.push(event);
      }

      const completedAt = new Date().toISOString();
      const changedFiles = this.extractChangedFiles(events);

      // 4. Verify via VCTRL.
      const verification = await this.deps.verification.verify({
        purpose: 'developer-handoff',
        executionId: request.executionId,
        agentRunId: request.executionId,
        repositoryRoot: request.repository?.root ?? process.cwd(),
        changedFiles,
      });

      // 5. Build evidence.
      const evidenceInput: CodingExecutionEvidenceInput = {
        outcome: 'completed',
        execution: {
          executionId: request.executionId,
          agentRunId: request.executionId,
          objective: request.goal,
        },
        agent: { id: agent.id, role: agent.role },
        runtime: {
          id: adapter.id,
          sessionId: session.id,
        },
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

      return {
        executionId: request.executionId,
        agentId: agent.id,
        outcome: 'completed',
        context,
        runtimeId: adapter.id,
        sessionId: session.id,
        changedFiles,
        verification,
        handoffEligible: verification.conclusion === 'pass' && verification.freshness === 'current',
        evidence,
        events,
      };
    } catch (error) {
      const completedAt = new Date().toISOString();

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
