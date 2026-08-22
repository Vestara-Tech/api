import type { AgentRuntime } from '../agent/runtime/agent-runtime.js';
import type { ToolRuntime } from '../tool/runtime/tool-runtime.js';
import type { AgentStepExecutor } from '../workflow/runtime/agent-step-executor.js';
import { WorkflowRegistry } from '../workflow/registry/workflow-registry.js';
import { WorkflowRuntime } from '../workflow/runtime/workflow-runtime.js';
import { WorkflowService } from '../workflow/service/workflow-service.js';

export interface WorkflowPlatformOptions {
  readonly agents: AgentRuntime;
  readonly tools: ToolRuntime;
  /** ARX-014 — Lazy dispatch boundary for agent steps. */
  readonly agentStepExecutor?: { get(): AgentStepExecutor } | undefined;
}

export interface WorkflowPlatform {
  readonly registry: WorkflowRegistry;
  readonly runtime: WorkflowRuntime;
  readonly service: WorkflowService;
}

/** WF-001..015 — Composition root for the Workflow Module. */
export function buildWorkflowPlatform(options: WorkflowPlatformOptions): WorkflowPlatform {
  const registry = new WorkflowRegistry();
  const runtime = new WorkflowRuntime({ registry, agents: options.agents, tools: options.tools, agentStepExecutor: options.agentStepExecutor });
  const service = new WorkflowService({ registry, runtime });
  return { registry, runtime, service };
}
