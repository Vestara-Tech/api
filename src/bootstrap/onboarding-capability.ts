import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerOnboardingCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.onboarding',
    namespace: 'onboarding',
    version: config.apiVersion,
    permissions: ['onboarding.read', 'onboarding.plan', 'onboarding.approve'],
    operations: [
      'onboarding.state.read',
      'onboarding.begin',
      'onboarding.steps.list',
      'onboarding.environment.discover',
      'onboarding.profile.list',
      'onboarding.plan.build',
      'onboarding.plan.approve',
    ],
  });
}
