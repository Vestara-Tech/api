import type {
  AgentRuntimePolicy,
  CodingAgentCapabilities,
  CodingAgentRuntimeHealth,
  CodingAgentRuntimeId,
  SelectedRuntime,
} from '../domain/contracts.js';
import type { CodingAgentRuntimeRegistry } from '../registry/coding-agent-runtime-registry.js';

export interface RuntimeSelectorOptions {
  readonly preference?: readonly CodingAgentRuntimeId[];
}

/**
 * CAR-005/006/007 — Runtime selection + fallback. Resolves a runtime policy
 * (vestara | auto | explicit) to a concrete runtime, matching capabilities
 * against the policy requirements. Fallback preserves capability requirements.
 */
export class RuntimeSelector {
  private readonly registry: CodingAgentRuntimeRegistry;
  private readonly preference: readonly CodingAgentRuntimeId[];

  constructor(registry: CodingAgentRuntimeRegistry, options: RuntimeSelectorOptions = {}) {
    this.registry = registry;
    this.preference = options.preference ?? ['opencode', 'codex', 'claude-code', 'gemini'];
  }

  async select(policy: AgentRuntimePolicy): Promise<SelectedRuntime> {
    if (policy.runtime === 'vestara') {
      const capabilities = await this.registry.get('vestara').capabilities();
      return { runtimeId: 'vestara', capabilities, viaFallback: false };
    }
    if (policy.runtime !== 'auto') {
      const id = policy.runtime;
      const capabilities = await this.registry.get(id).capabilities();
      return { runtimeId: id, capabilities, viaFallback: false };
    }

    // Auto: try the preference order, matching required capabilities.
    const requirements = policy.requirements ?? {};
    const chain = [...this.preference, ...(policy.fallback ?? [])];
    const seen = new Set<CodingAgentRuntimeId>();
    for (const id of chain) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (!this.registry.has(id)) continue;
      const capabilities = await this.registry.get(id).capabilities();
      if (matches(capabilities, requirements)) {
        return { runtimeId: id, capabilities, viaFallback: seen.size > 1 };
      }
    }
    // Native Vestara runtime always satisfies the core requirements.
    const native = await this.registry.get('vestara').capabilities();
    return { runtimeId: 'vestara', capabilities: native, viaFallback: true };
  }

  async health(): Promise<readonly CodingAgentRuntimeHealth[]> {
    const health: CodingAgentRuntimeHealth[] = [];
    for (const id of this.registry.list().map((r) => r.id)) {
      try {
        await this.registry.get(id).capabilities();
        health.push({ runtimeId: id, healthy: true });
      } catch (err) {
        health.push({ runtimeId: id, healthy: false, message: (err as Error).message });
      }
    }
    return health;
  }
}

function matches(capabilities: CodingAgentCapabilities, requirements: NonNullable<AgentRuntimePolicy['requirements']>): boolean {
  if (requirements.repositoryEditing !== undefined && capabilities.repositoryContext !== requirements.repositoryEditing) return false;
  if (requirements.terminal !== undefined && capabilities.shell !== requirements.terminal) return false;
  if (requirements.tools !== undefined && capabilities.tools !== requirements.tools) return false;
  if (requirements.resumableSessions !== undefined && capabilities.resumableSessions !== requirements.resumableSessions) return false;
  if (requirements.structuredOutput !== undefined && capabilities.structuredOutput !== requirements.structuredOutput) return false;
  return true;
}
