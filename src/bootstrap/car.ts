import type { AgentRuntime } from '../agent/runtime/agent-runtime.js';
import type { ApprovalRuntime } from '../agent/approval/approval-runtime.js';
import type { ToolRuntime } from '../tool/runtime/tool-runtime.js';
import { CodingAgentRuntimeRegistry } from '../car/registry/coding-agent-runtime-registry.js';
import { RuntimeSelector } from '../car/runtime/runtime-selector.js';
import { ToolGateway } from '../car/runtime/tool-gateway.js';
import { OpenCodeAdapter } from '../car/adapters/opencode-adapter.js';
import { CodexAdapter } from '../car/adapters/codex-adapter.js';
import { VestaraCodingAdapter } from '../car/adapters/vestara-coding-adapter.js';
import type { OpenCodeEnvironmentConfig } from '../car/domain/opencode-config.js';

export interface CarPlatformOptions {
  readonly agents: AgentRuntime;
  readonly tools: ToolRuntime;
  readonly approvals: ApprovalRuntime;
  /** DEX-CP0 — Typed OpenCode runtime configuration. Replaces the bare baseUrl string. */
  readonly openCode?: OpenCodeEnvironmentConfig;
}

export interface CarPlatform {
  readonly registry: CodingAgentRuntimeRegistry;
  readonly selector: RuntimeSelector;
  readonly gateway: ToolGateway;
}

/** CAR — Composition root. Registers the native Vestara runtime plus the OpenCode and Codex SDK-backed adapters. */
export function buildCarPlatform(options: CarPlatformOptions): CarPlatform {
  const registry = new CodingAgentRuntimeRegistry();
  registry.register(new VestaraCodingAdapter(options.agents));
  registry.register(new OpenCodeAdapter(options.openCode));
  registry.register(new CodexAdapter());

  const selector = new RuntimeSelector(registry);
  const gateway = new ToolGateway({ tools: options.tools, approvals: options.approvals });
  return { registry, selector, gateway };
}
