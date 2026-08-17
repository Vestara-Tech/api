import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerOnboardingCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.onboarding',
    namespace: 'onboarding',
    version: config.apiVersion,
    permissions: ['onboarding.read', 'onboarding.plan', 'onboarding.approve', 'onboarding.execute'],
    operations: [
      'onboarding.state.read',
      'onboarding.begin',
      'onboarding.steps.list',
      'onboarding.environment.discover',
      'onboarding.profile.list',
      'onboarding.plan.build',
      'onboarding.plan.approve',
      'onboarding.execute',
      'onboarding.execution.status',
      'onboarding.execution.resume',
      'onboarding.execution.rollback',
      'onboarding.verify',
      'onboarding.ready',
    ],
  });
}
