import type { AiModelCatalog } from '../ai/catalog/model-catalog.js';
import type { AiProviderRegistry } from '../ai/providers/provider-registry.js';
import { buildAiPlatformV2, type AiPlatformV2 } from '../ai/v2/ai-platform-v2.js';
import type { AiProviderConfig } from '../ai/v2/provider-state.js';
import type { AiService } from '../ai/runtime/ai-runtime.js';
import { AiRuntimeV2 } from '../ai/v2/runtime-v2.js';
import { AiSessionManager } from '../ai/v2/session.js';
import { BudgetEngine } from '../ai/v2/budget.js';
import { UsageAggregator } from '../ai/v2/usage.js';
import { AiTracer } from '../ai/v2/trace.js';

export interface AiV2Platform {
  readonly platform: AiPlatformV2;
  readonly sessions: AiSessionManager;
  readonly budgets: BudgetEngine;
  readonly usage: UsageAggregator;
  readonly tracer: AiTracer;
  readonly runtime: AiRuntimeV2;
}

/**
 * AI2 — Composition root. Builds the profile + provider-state + routing v2
 * platform over the base AI service's catalog/registry, plus the session/
 * budget/usage/trace/evidence runtime.
 */
export function buildAiPlatformV2Service(catalog: AiModelCatalog, providers: AiProviderRegistry, service: AiService, providerStates?: readonly AiProviderConfig[]): AiV2Platform {
  const platform = buildAiPlatformV2({ catalog, providers, ...(providerStates ? { providerStates } : {}) });
  const sessions = new AiSessionManager();
  const budgets = new BudgetEngine();
  const usage = new UsageAggregator();
  const tracer = new AiTracer();
  const runtime = new AiRuntimeV2({ service, platform, sessions, budgets, usage, tracer });
  return { platform, sessions, budgets, usage, tracer, runtime };
}
