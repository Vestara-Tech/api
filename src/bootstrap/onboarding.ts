import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { ConfigurationService } from '../configuration/service/configuration-service.js';
import type { GeneratorRegistry } from '../generator/registry/generator-registry.js';
import type { IdentityService } from '../auth/service/identity-service.js';
import type { MarketplacePlatform } from './marketplace.js';
import type { AiService } from '../ai/runtime/ai-runtime.js';
import type { AgentPlatform } from './agent-platform.js';
import type { DatabasePlatform } from './database.js';
import type { FilePlatform } from './file.js';
import type { DiagnosticsPlatform } from './diagnostics.js';
import { OnboardingService } from '../onboarding/service/onboarding-service.js';
import {
  authOwnerContributor,
  configContributor,
  generatorContributor,
} from '../onboarding/contributors/builtin.js';
import {
  marketplaceContributor,
  aiContributor,
  agentContributor,
  databaseContributor,
  workspaceContributor,
  integrationContributor,
  diagnosticsContributor,
} from '../onboarding/contributors/platform-contributors.js';
import type { OnboardingContext } from '../onboarding/service/onboarding-context.js';

export interface OnboardingBootstrapInput {
  readonly capabilities: CapabilityRegistry;
  readonly configuration: ConfigurationService;
  readonly generators: GeneratorRegistry;
  readonly identities: IdentityService;
  readonly marketplace?: MarketplacePlatform;
  readonly ai?: AiService;
  readonly agents?: AgentPlatform;
  readonly database?: DatabasePlatform;
  readonly file?: FilePlatform;
  readonly diagnostics?: DiagnosticsPlatform;
}

export function buildOnboardingService(input: OnboardingBootstrapInput): OnboardingService {
  const context: OnboardingContext = {
    capabilities: input.capabilities,
    configuration: input.configuration,
    generators: input.generators,
    identities: input.identities,
    marketplace: input.marketplace,
    ai: input.ai,
    agents: input.agents,
    database: input.database,
    file: input.file,
    diagnostics: input.diagnostics,
  };
  const service = new OnboardingService({ context });
  service.registerContributor(authOwnerContributor);
  service.registerContributor(configContributor);
  service.registerContributor(generatorContributor);
  service.registerContributor(marketplaceContributor);
  service.registerContributor(aiContributor);
  service.registerContributor(agentContributor);
  service.registerContributor(databaseContributor);
  service.registerContributor(workspaceContributor);
  service.registerContributor(integrationContributor);
  service.registerContributor(diagnosticsContributor);
  return service;
}
