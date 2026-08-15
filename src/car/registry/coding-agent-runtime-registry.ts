import { notFound } from '../../core/errors.js';
import type { CodingAgentRuntime, CodingAgentRuntimeId } from '../domain/contracts.js';

/**
 * CAR-002 — Coding Agent Runtime registry. Normalizes OpenCode, Claude Code,
 * Codex, Gemini and the native Vestara runtime behind the CodingAgentRuntime
 * contract. Provider SDKs never leak outside their adapter directories.
 */
export class CodingAgentRuntimeRegistry {
  private readonly runtimes = new Map<CodingAgentRuntimeId, CodingAgentRuntime>();

  register(runtime: CodingAgentRuntime): void {
    this.runtimes.set(runtime.id, runtime);
  }

  get(id: CodingAgentRuntimeId): CodingAgentRuntime {
    const runtime = this.runtimes.get(id);
    if (!runtime) throw notFound(`Coding agent runtime "${id}" not found`);
    return runtime;
  }

  has(id: CodingAgentRuntimeId): boolean {
    return this.runtimes.has(id);
  }

  list(): readonly CodingAgentRuntime[] {
    return [...this.runtimes.values()];
  }
}
