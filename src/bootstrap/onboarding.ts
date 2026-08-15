import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { ConfigurationService } from '../configuration/service/configuration-service.js';
import type { GeneratorRegistry } from '../generator/registry/generator-registry.js';
import type { IdentityService } from '../auth/service/identity-service.js';
import { OnboardingService } from '../onboarding/service/onboarding-service.js';
import { authOwnerContributor, configContributor, generatorContributor } from '../onboarding/contributors/builtin.js';
import type { OnboardingContext } from '../onboarding/service/onboarding-context.js';

export interface OnboardingBootstrapInput {
  readonly capabilities: CapabilityRegistry;
  readonly configuration: ConfigurationService;
  readonly generators: GeneratorRegistry;
  readonly identities: IdentityService;
}

export function buildOnboardingService(input: OnboardingBootstrapInput): OnboardingService {
  const context: OnboardingContext = {
    capabilities: input.capabilities,
    configuration: input.configuration,
    generators: input.generators,
    identities: input.identities,
  };
  const service = new OnboardingService({ context });
  service.registerContributor(authOwnerContributor);
  service.registerContributor(configContributor);
  service.registerContributor(generatorContributor);
  return service;
}
