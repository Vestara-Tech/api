import type { CapabilityRegistry } from '../../capabilities/registry.js';
import type { ConfigurationService } from '../../configuration/service/configuration-service.js';
import type { GeneratorRegistry } from '../../generator/registry/generator-registry.js';
import type { IdentityService } from '../../auth/service/identity-service.js';

/**
 * Context made available to onboarding contributors. Contributors receive the
 * context, never reach into globals.
 */
export interface OnboardingContext {
  readonly capabilities: CapabilityRegistry;
  readonly configuration: ConfigurationService;
  readonly generators: GeneratorRegistry;
  readonly identities: IdentityService;
}
