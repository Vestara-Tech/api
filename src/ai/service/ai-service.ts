import type { AiProvider } from '../domain/contracts.js';
import { AiModelCatalog } from '../catalog/model-catalog.js';
import { AiProviderRegistry } from '../providers/provider-registry.js';
import { OpenAiCompatibleAdapter } from '../providers/openai-compatible.js';
import { ModelRouter, type RoutingConfig } from '../runtime/model-router.js';
import { AiService } from '../runtime/ai-runtime.js';
import { CostEstimator } from '../policies/cost-estimator.js';
import { BudgetPolicy } from '../policies/budget-policy.js';

export interface AiServiceOptions {
  readonly providers?: readonly AiProvider[];
  readonly models?: readonly Parameters<AiModelCatalog['upsert']>[0][];
  readonly routing?: RoutingConfig;
  readonly defaultApiEndpoint?: string;
  readonly budgets?: BudgetPolicy;
  readonly costs?: CostEstimator;
}

/**
 * Declared-by-default providers. Actual credentials are secret references
 * (secret://integrations/<provider>/api-key), supplied by the Integration
 * module — never stored here.
 */
export const DEFAULT_AI_PROVIDERS: readonly AiProvider[] = [
  { id: 'openai', name: 'OpenAI', type: 'openai-compatible', enabled: false, priority: 10, apiEndpoint: 'https://api.openai.com/v1' },
  { id: 'openrouter', name: 'OpenRouter', type: 'gateway', enabled: false, priority: 20, apiEndpoint: 'https://openrouter.ai/api/v1' },
  { id: 'anthropic', name: 'Anthropic', type: 'native', enabled: false, priority: 30 },
  { id: 'google', name: 'Google', type: 'native', enabled: false, priority: 40 },
  { id: 'ollama', name: 'Ollama', type: 'local', enabled: false, priority: 50, apiEndpoint: 'http://localhost:11434/v1' },
];

export function buildAiService(options: AiServiceOptions = {}): {
  service: AiService;
  registry: AiProviderRegistry;
  catalog: AiModelCatalog;
  router: ModelRouter;
  budgets: BudgetPolicy;
  costs: CostEstimator;
} {
  const registry = new AiProviderRegistry();
  for (const provider of options.providers ?? DEFAULT_AI_PROVIDERS) {
    const endpoint = provider.apiEndpoint ?? options.defaultApiEndpoint;
    const adapter = new OpenAiCompatibleAdapter(provider.id, endpoint ?? '', '');
    registry.register({ provider, adapter });
  }

  const catalog = new AiModelCatalog(options.models !== undefined ? { models: options.models } : {});
  const router = new ModelRouter(catalog, registry, options.routing ?? { defaultProfile: 'auto', enabledProviders: [] });
  const costs = options.costs ?? new CostEstimator();
  const budgets = options.budgets ?? new BudgetPolicy();
  const service = new AiService({ router, catalog, providers: registry, costs, budgets });

  return { service, registry, catalog, router, budgets, costs };
}
