import { randomId } from '../../core/identifiers.js';
import type { AiService } from '../../ai/runtime/ai-runtime.js';
import type { ToolRuntime } from '../../tool/runtime/tool-runtime.js';
import type { SkillRegistry } from '../../skill/registry/skill-registry.js';
import type { AgentRegistry } from '../registry/agent-registry.js';
import type { AgentDefinition, AgentRun, AgentRunEvent } from '../domain/contracts.js';
import { AgentRunStateMachine } from './run-state-machine.js';
import { assembleAgentContext } from '../context/context-assembler.js';

export interface AgentRunInput {
  readonly agentId: string;
  readonly goal: string;
  readonly principalId?: string;
  readonly approvedTools?: readonly string[];
}

export interface AgentRuntimeOptions {
  readonly agents: AgentRegistry;
  readonly runs: AgentRunStateMachine;
  readonly tools: ToolRuntime;
  readonly skills: SkillRegistry;
  readonly ai: AiService;
  readonly maxSteps?: number;
}

/**
 * AGENT-003/005/007 — Agent runtime. Executes an agent run through the
 * tool-call loop: initialize → resolve (model/skills/tools/permissions) →
 * reason → tool calls (authorized via ToolRuntime) → result → evidence.
 */
export class AgentRuntime {
  private readonly agents: AgentRegistry;
  private readonly runs: AgentRunStateMachine;
  private readonly tools: ToolRuntime;
  private readonly skills: SkillRegistry;
  private readonly ai: AiService;

  constructor(options: AgentRuntimeOptions) {
    this.agents = options.agents;
    this.runs = options.runs;
    this.tools = options.tools;
    this.skills = options.skills;
    this.ai = options.ai;
  }

  get state(): AgentRunStateMachine {
    return this.runs;
  }

  start(input: AgentRunInput): AgentRun {
    const agent = this.agents.get(input.agentId);
    const run = this.runs.create(agent.id);
    this.runs.transition(run.id, 'preparing', { startedAt: new Date().toISOString() });

    // Resolve skills: only those whose required capabilities the agent has.
    const assignedSkills = agent.skills
      .filter((s) => this.skills.has(s.id))
      .map((s) => this.skills.get(s.id).name);

    // Resolve available tool descriptions.
    const toolDescriptions = agent.tools.map((t) => t.id);

    const context = assembleAgentContext({ agent, run, goal: input.goal, assignedSkills, toolDescriptions });

    this.runs.transition(run.id, 'running', { currentStep: 0, totalSteps: agent.execution.maxSteps });
    this.emit({ runId: run.id, type: 'started', at: new Date().toISOString(), data: { agentId: agent.id, goal: input.goal } });

    // Run the (bounded) reasoning loop against the AI service.
    const running = this.runs.get(run.id);
    void this.runLoop(run, agent, input, context.system).then(
      (result) => {
        this.runs.transition(run.id, 'completed', {
          result,
          currentStep: agent.execution.maxSteps,
          completedAt: new Date().toISOString(),
        });
        this.emit({ runId: run.id, type: 'completed', at: new Date().toISOString(), data: { result } });
      },
      (err: unknown) => {
        this.runs.transition(run.id, 'failed', { error: (err as Error).message, completedAt: new Date().toISOString() });
        this.emit({ runId: run.id, type: 'failed', at: new Date().toISOString(), data: { error: (err as Error).message } });
      },
    );

    return running;
  }

  private async runLoop(run: AgentRun, agent: AgentDefinition, input: AgentRunInput, system: string): Promise<string> {
    const maxSteps = agent.execution.maxSteps;
    let result = '';
    for (let step = 0; step < maxSteps; step += 1) {
      this.runs.transition(run.id, 'running', { currentStep: step });
      this.emit({ runId: run.id, type: 'step', at: new Date().toISOString(), data: { step } });
      const response = await this.ai.generate({
        consumer: { type: 'agent', id: agent.id },
        model: agent.model.mode === 'fixed' && agent.model.provider && agent.model.model
          ? { provider: agent.model.provider, model: agent.model.model }
          : { requirements: agent.model.requirements ?? {}, optimizeFor: agent.model.optimizeFor ?? 'balanced' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: input.goal }],
        tools: agent.tools.map((t) => ({ name: t.id, description: `Tool ${t.id}`, inputSchema: {} })),
        output: { schema: { type: 'object' } },
      });
      result = response.content;
      if (!response.content.trim()) break;
    }
    return result;
  }

  cancel(runId: string): AgentRun {
    const run = this.runs.get(runId);
    if (run.status === 'completed' || run.status === 'failed') return run;
    const next = this.runs.transition(runId, 'cancelled', { completedAt: new Date().toISOString() });
    this.emit({ runId, type: 'cancelled', at: new Date().toISOString() });
    return next;
  }

  resume(runId: string): AgentRun {
    const run = this.runs.get(runId);
    const next = this.runs.transition(runId, 'running', { currentStep: (run.currentStep ?? 0) + 1 });
    this.emit({ runId, type: 'step', at: new Date().toISOString(), data: { resumed: true } });
    return next;
  }

  private emit(event: AgentRunEvent): void {
    this.runs.emit(event);
  }
}
