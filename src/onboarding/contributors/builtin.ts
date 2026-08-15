import type { OnboardingContributor, OnboardingStepDefinition, OnboardingValidationResult } from '../domain/contributor.js';
import type { OnboardingOperation } from '../domain/plan.js';
import type { OnboardingContext } from '../service/onboarding-context.js';
import { randomId } from '../../core/identifiers.js';

/**
 * Authentication contributes the Owner Setup step. It orchestrates the
 * Authentication module — it does not own identity implementation.
 */
export const authOwnerContributor: OnboardingContributor = {
  id: 'owner',
  capability: 'auth',
  order: 10,
  optional: false,

  async isAvailable(context: OnboardingContext) {
    return context.capabilities.has('auth');
  },

  async describe(): Promise<OnboardingStepDefinition> {
    return {
      id: 'owner',
      title: 'Owner',
      description: 'Create the first Vestara owner account',
      capability: 'auth',
      order: 10,
      optional: false,
    };
  },

  async validate(input: unknown): Promise<OnboardingValidationResult> {
    const owner = (input ?? {}) as { displayName?: unknown; email?: unknown; password?: unknown };
    const issues: Array<OnboardingValidationResult['issues'][number]> = [];
    if (!owner.displayName || typeof owner.displayName !== 'string' || owner.displayName.trim().length === 0) {
      issues.push({ path: 'owner.displayName', message: 'display name is required', severity: 'error' });
    }
    if (!owner.email || typeof owner.email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(owner.email)) {
      issues.push({ path: 'owner.email', message: 'valid email is required', severity: 'error' });
    }
    if (!owner.password || typeof owner.password !== 'string' || owner.password.length < 8) {
      issues.push({ path: 'owner.password', message: 'password must be at least 8 characters', severity: 'error' });
    }
    return { ok: issues.every((i) => i.severity !== 'error'), issues };
  },

  async plan(input: unknown): Promise<readonly OnboardingOperation[]> {
    const owner = (input ?? {}) as { displayName?: string; email?: string };
    return [
      {
        id: randomId('op'),
        kind: 'identity.create',
        capability: 'auth',
        order: 10,
        input: { displayName: owner.displayName, email: owner.email },
      },
    ];
  },
};

/**
 * Configuration contributes the Platform Configuration step.
 */
export const configContributor: OnboardingContributor = {
  id: 'configuration',
  capability: 'configuration',
  order: 20,
  optional: true,

  async isAvailable(context: OnboardingContext) {
    return context.capabilities.has('config');
  },

  async describe(): Promise<OnboardingStepDefinition> {
    return {
      id: 'configuration',
      title: 'Configuration',
      description: 'Platform configuration defaults',
      capability: 'configuration',
      order: 20,
      optional: true,
    };
  },

  async validate(input: unknown): Promise<OnboardingValidationResult> {
    void input;
    return { ok: true, issues: [] };
  },

  async plan(input: unknown): Promise<readonly OnboardingOperation[]> {
    const values = (input ?? {}) as Readonly<Record<string, unknown>>;
    return [
      {
        id: randomId('op'),
        kind: 'config.apply',
        capability: 'configuration',
        order: 20,
        input: values,
        optional: true,
      },
    ];
  },
};

/**
 * Generator contributes the Generator Setup step (which generators to enable).
 */
export const generatorContributor: OnboardingContributor = {
  id: 'generator',
  capability: 'generator',
  order: 30,
  optional: true,

  async isAvailable(context: OnboardingContext) {
    return context.capabilities.has('generator');
  },

  async describe(context: OnboardingContext): Promise<OnboardingStepDefinition> {
    const count = context.generators.list().length;
    return {
      id: 'generator',
      title: 'Generator',
      description: `${count} generator(s) available`,
      capability: 'generator',
      order: 30,
      optional: true,
    };
  },

  async validate(): Promise<OnboardingValidationResult> {
    return { ok: true, issues: [] };
  },

  async plan(input: unknown): Promise<readonly OnboardingOperation[]> {
    const ids = (input as { generatorIds?: readonly string[] } | undefined)?.generatorIds ?? [];
    return ids.map((generatorId) => ({
      id: randomId('op'),
      kind: 'capability.enable',
      capability: 'generator',
      order: 30,
      input: { generatorId },
      optional: true,
    }));
  },
};
