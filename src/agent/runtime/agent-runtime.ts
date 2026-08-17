import type { AiService } from '../../ai/runtime/ai-runtime.js';
import type { AiMessage, AiModelSelector, AiToolCall } from '../../ai/domain/contracts.js';
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

    const running = this.runs.get(run.id);
    void this.runLoop(run, agent, input, context.system).then(
      (result) => {
        const current = this.runs.get(run.id);
        if (current.status === 'waiting-for-approval' || current.status === 'suspended') {
          return;
        }
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

  /**
   * AGENT-007 — The tool-call loop. Send messages to the AI; if the response
   * contains tool calls, execute them via the authorized ToolRuntime and feed
   * the results back; repeat until the model produces a final answer or the
   * step budget is exhausted.
   */
  private async runLoop(run: AgentRun, agent: AgentDefinition, input: AgentRunInput, system: string): Promise<string> {
    const maxSteps = agent.execution.maxSteps;
    const messages: AiMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: input.goal },
    ];
    const approved = new Set(input.approvedTools ?? []);

    for (let step = 0; step < maxSteps; step += 1) {
      this.runs.transition(run.id, 'running', { currentStep: step });
      this.emit({ runId: run.id, type: 'step', at: new Date().toISOString(), data: { step } });

      const response = await this.ai.generate({
        consumer: { type: 'agent', id: agent.id },
        model: modelSelector(agent.model),
        messages,
        tools: agent.tools.map((t) => ({ name: t.id, description: `Tool ${t.id}`, inputSchema: {} })),
        output: { schema: { type: 'object' } },
      });

      const toolCalls = response.toolCalls ?? [];
      if (toolCalls.length === 0) {
        // Final answer.
        return response.content;
      }

      // Execute each tool call; feed results back into the conversation.
      for (const call of toolCalls) {
        this.emit({ runId: run.id, type: 'tool-call', at: new Date().toISOString(), data: { tool: call.name, arguments: call.arguments } });
        let resultText: string;
        try {
          const result = await this.tools.execute(
            agent.id,
            run.id,
            call.name,
            parseArguments(call.arguments),
            {
              principalId: input.principalId ?? `agent:${agent.id}`,
              ...(approved.has(call.name) ? { approved: true, authorizedBy: input.principalId ?? `agent:${agent.id}` } : {}),
            },
          );
          resultText = result.ok
            ? JSON.stringify({ ok: true, output: result.output })
            : JSON.stringify({ ok: false, error: result.error });
        } catch (err) {
          const message = (err as Error).message;
          if (message.includes('requires human approval')) {
            this.runs.transition(run.id, 'waiting-for-approval', { approvalRequired: call.name });
            this.emit({ runId: run.id, type: 'approval-requested', at: new Date().toISOString(), data: { tool: call.name } });
            return `Suspended: tool "${call.name}" requires human approval.`;
          }
          resultText = JSON.stringify({ ok: false, error: message });
        }
        this.emit({ runId: run.id, type: 'tool-result', at: new Date().toISOString(), data: { tool: call.name, result: resultText } });
        messages.push({
          role: 'assistant',
          content: '',
          toolCalls: [call],
        });
        messages.push({
          role: 'tool',
          content: resultText,
          toolCallId: call.id,
        });
      }
    }
    return 'Reached the step budget without a final answer.';
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

function modelSelector(model: AgentDefinition['model']): AiModelSelector {
  if (model.mode === 'fixed' && model.provider && model.model) {
    return { provider: model.provider, model: model.model };
  }
  return {
    requirements: model.requirements ?? {},
    ...(model.optimizeFor !== undefined ? { optimizeFor: model.optimizeFor } : {}),
  };
}

function parseArguments(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return {};
  }
}
