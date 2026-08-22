import { describe, expect, it } from 'vitest';
import { buildAiService } from '../../src/ai/service/ai-service.js';
import type { OpenCodeEnvironmentConfig } from '../../src/car/domain/opencode-config.js';

const OPCODE_CONFIG: OpenCodeEnvironmentConfig = {
  mode: 'external',
  baseUrl: 'http://127.0.0.1:4096',
  defaultProvider: 'opencode',
  defaultModel: 'opencode/deepseek-v4-flash-free',
  startupTimeoutMs: 30_000,
};

// The built-in Developer agent requests tools + structured output
// (src/agent/registry/builtin-agents.ts — vestara-developer).
const DEVELOPER_REQUIREMENTS = { tools: true, structuredOutput: true };

describe('ARX stabilization — model selection for the Activity Room agent run', () => {
  it('fails with structured rejection diagnostics when nothing is configured', () => {
    const { router } = buildAiService({});

    let error: unknown;
    try {
      router.resolve({ requirements: DEVELOPER_REQUIREMENTS, optimizeFor: 'balanced' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    const message = (error as Error).message;
    expect(message).toContain('No enabled model satisfies the requested capabilities');
    expect(message).toContain('Requested:');
    expect(message).toContain('tools: required');
    expect(message).toContain('structuredOutput: required');
    expect(message).toContain('Candidates (0)');
  });

  it('resolves the configured OpenCode default model as an enabled capability-compatible candidate', () => {
    const { router } = buildAiService({ openCode: OPCODE_CONFIG });

    const resolved = router.resolve({ requirements: DEVELOPER_REQUIREMENTS, optimizeFor: 'balanced' });
    expect(resolved.providerId).toBe('opencode');
    expect(resolved.modelId).toBe('deepseek-v4-flash-free');
    expect(resolved.capabilities.tools).toBe(true);
    expect(resolved.capabilities.structuredOutput).toBe(true);
  });

  it('resolves the Developer agent selector exactly as AgentRuntime builds it', () => {
    const { router } = buildAiService({ openCode: OPCODE_CONFIG });

    // modelSelector({ mode: 'auto', requirements: { tools, structuredOutput }, optimizeFor: 'balanced' })
    const resolved = router.resolve({
      requirements: { tools: true, structuredOutput: true },
      optimizeFor: 'balanced',
    });
    expect(resolved.providerId).toBe('opencode');
  });

  it('preserves capability enforcement — reasoning requirement still fails with diagnostics', () => {
    // Note: the seeded OpenCode candidate declares reasoning: true, so use a
    // capability it does not provide to prove enforcement is preserved.
    const { router } = buildAiService({ openCode: OPCODE_CONFIG });

    let error: unknown;
    try {
      router.resolve({ requirements: { vision: true }, optimizeFor: 'quality' });
    } catch (err) {
      error = err;
    }

    expect(error).toBeDefined();
    const message = (error as Error).message;
    expect(message).toContain('vision: required');
    expect(message).toContain('vision mismatch');
  });

  it('does not auto-enable providers when OpenCode has no default model', () => {
    const { router, registry } = buildAiService({
      openCode: { mode: 'external', baseUrl: 'http://127.0.0.1:4096', startupTimeoutMs: 30_000 },
    });

    expect(registry.listEnabledProviders()).toEqual([]);
    expect(router.resolve).toBeTypeOf('function');
  });
});