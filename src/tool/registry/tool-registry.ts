import { conflict, notFound } from '../../core/errors.js';
import type { ToolContribution, ToolDefinition, ToolExecutionContext } from '../domain/contracts.js';

/**
 * TOOL-002 — Tool registry. Tools are discovered from ToolContributors (each
 * module optionally exposes getToolContributions). New modules (e.g. a future
 * Marketplace) can make functionality agent-accessible without modifying the
 * Agent runtime.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.id)) throw conflict(`Tool "${tool.id}" already registered`);
    this.tools.set(tool.id, tool);
  }

  /** Register a capability contribution as a tool. */
  registerContribution(contribution: ToolContribution): void {
    const tool: ToolDefinition = {
      id: contribution.toolId,
      version: contribution.version,
      description: contribution.description,
      inputSchema: contribution.inputSchema,
      outputSchema: contribution.outputSchema,
      capabilities: contribution.capabilities,
      risk: contribution.risk,
      execute: async (context: ToolExecutionContext, input: unknown) => {
        const startedAt = Date.now();
        try {
          const output = await contribution.handler(context, input);
          return { ok: true, output, durationMs: Date.now() - startedAt };
        } catch (err) {
          return { ok: false, error: (err as Error).message, durationMs: Date.now() - startedAt };
        }
      },
    };
    this.register(tool);
  }

  get(id: string): ToolDefinition {
    const tool = this.tools.get(id);
    if (!tool) throw notFound(`Tool "${id}" not found`);
    return tool;
  }

  has(id: string): boolean {
    return this.tools.has(id);
  }

  list(): readonly ToolDefinition[] {
    return [...this.tools.values()].sort((a, b) => a.id.localeCompare(b.id));
  }

  listByCapability(capability: string): readonly ToolDefinition[] {
    return this.list().filter((t) => t.capabilities.includes(capability));
  }
}
