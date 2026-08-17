import type { OnboardingContributor, OnboardingStepDefinition, OnboardingValidationResult } from '../domain/contributor.js';
import type { OnboardingOperation } from '../domain/plan.js';
import type { OnboardingContext } from '../service/onboarding-context.js';
import { randomId } from '../../core/identifiers.js';

/**
 * ONB-017 — Marketplace contributor.
 *
 * Installs packages from the marketplace during onboarding.
 */
export const marketplaceContributor: OnboardingContributor = {
  id: 'marketplace-packages',
  capability: 'marketplace',
  order: 40,
  optional: true,

  async isAvailable(context: OnboardingContext) {
    return context.marketplace !== undefined;
  },

  async describe(): Promise<OnboardingStepDefinition> {
    return {
      id: 'marketplace-packages',
      title: 'Packages',
      description: 'Install packages from the Vestara Marketplace',
      capability: 'marketplace',
      order: 40,
      optional: true,
    };
  },

  async validate(input: unknown): Promise<OnboardingValidationResult> {
    const ids = (input as { packageIds?: readonly string[] } | undefined)?.packageIds;
    if (ids !== undefined && (!Array.isArray(ids) || ids.length === 0)) {
      return { ok: false, issues: [{ path: 'marketplace.packageIds', message: 'Provide at least one package ID or omit to skip', severity: 'error' }] };
    }
    return { ok: true, issues: [] };
  },

  async plan(input: unknown): Promise<readonly OnboardingOperation[]> {
    const ids = (input as { packageIds?: readonly string[] } | undefined)?.packageIds ?? [];
    return ids.map((packageId, index) => ({
      id: randomId('op'),
      kind: 'package.installFromMarketplace' as const,
      capability: 'marketplace',
      order: 40 + index,
      input: { packageId },
      optional: true,
    }));
  },
};

/**
 * ONB-018 — AI contributor.
 *
 * Configures AI providers and models during onboarding.
 */
export const aiContributor: OnboardingContributor = {
  id: 'ai-config',
  capability: 'ai',
  order: 50,
  optional: true,

  async isAvailable(context: OnboardingContext) {
    return context.ai !== undefined;
  },

  async describe(): Promise<OnboardingStepDefinition> {
    return {
      id: 'ai-config',
      title: 'AI',
      description: 'Configure AI providers and models',
      capability: 'ai',
      order: 50,
      optional: true,
    };
  },

  async validate(): Promise<OnboardingValidationResult> {
    return { ok: true, issues: [] };
  },

  async plan(input: unknown): Promise<readonly OnboardingOperation[]> {
    const cfg = (input ?? {}) as Readonly<Record<string, unknown>>;
    return [{
      id: randomId('op'),
      kind: 'ai.configure',
      capability: 'ai',
      order: 50,
      input: cfg,
      optional: true,
    }];
  },
};

/**
 * ONB-019 — Agent contributor.
 *
 * Configures agents and their tools during onboarding.
 */
export const agentContributor: OnboardingContributor = {
  id: 'agent-config',
  capability: 'agents',
  order: 60,
  optional: true,

  async isAvailable(context: OnboardingContext) {
    return context.agents !== undefined;
  },

  async describe(): Promise<OnboardingStepDefinition> {
    return {
      id: 'agent-config',
      title: 'Agents',
      description: 'Configure agents and tools',
      capability: 'agents',
      order: 60,
      optional: true,
    };
  },

  async validate(): Promise<OnboardingValidationResult> {
    return { ok: true, issues: [] };
  },

  async plan(input: unknown): Promise<readonly OnboardingOperation[]> {
    const cfg = (input ?? {}) as Readonly<Record<string, unknown>>;
    return [{
      id: randomId('op'),
      kind: 'agent.configure',
      capability: 'agents',
      order: 60,
      input: cfg,
      optional: true,
    }];
  },
};

/**
 * ONB-020 — Database contributor.
 *
 * Configures the database during onboarding.
 */
export const databaseContributor: OnboardingContributor = {
  id: 'database-config',
  capability: 'database',
  order: 70,
  optional: true,

  async isAvailable(context: OnboardingContext) {
    return context.database !== undefined;
  },

  async describe(): Promise<OnboardingStepDefinition> {
    return {
      id: 'database-config',
      title: 'Database',
      description: 'Configure the Vestara database',
      capability: 'database',
      order: 70,
      optional: true,
    };
  },

  async validate(): Promise<OnboardingValidationResult> {
    return { ok: true, issues: [] };
  },

  async plan(input: unknown): Promise<readonly OnboardingOperation[]> {
    const cfg = (input ?? {}) as Readonly<Record<string, unknown>>;
    return [{
      id: randomId('op'),
      kind: 'database.configure',
      capability: 'database',
      order: 70,
      input: cfg,
      optional: true,
    }];
  },
};

/**
 * ONB-021 — Workspace contributor.
 *
 * Configures the workspace environment during onboarding.
 */
export const workspaceContributor: OnboardingContributor = {
  id: 'workspace-config',
  capability: 'workspace',
  order: 80,
  optional: true,

  async isAvailable(_context: OnboardingContext) {
    return false; // Workspace is a UI-only module, no backend to configure
  },

  async describe(): Promise<OnboardingStepDefinition> {
    return {
      id: 'workspace-config',
      title: 'Workspace',
      description: 'Configure the workspace environment',
      capability: 'workspace',
      order: 80,
      optional: true,
    };
  },

  async validate(): Promise<OnboardingValidationResult> {
    return { ok: true, issues: [] };
  },

  async plan(input: unknown): Promise<readonly OnboardingOperation[]> {
    const cfg = (input ?? {}) as Readonly<Record<string, unknown>>;
    return [{
      id: randomId('op'),
      kind: 'workspace.configure',
      capability: 'workspace',
      order: 80,
      input: cfg,
      optional: true,
    }];
  },
};

/**
 * ONB-022 — Integration contributor.
 *
 * Configures external integrations during onboarding.
 */
export const integrationContributor: OnboardingContributor = {
  id: 'integration-config',
  capability: 'integration',
  order: 90,
  optional: true,

  async isAvailable(context: OnboardingContext) {
    return true;
  },

  async describe(): Promise<OnboardingStepDefinition> {
    return {
      id: 'integration-config',
      title: 'Integrations',
      description: 'Configure external integrations',
      capability: 'integration',
      order: 90,
      optional: true,
    };
  },

  async validate(): Promise<OnboardingValidationResult> {
    return { ok: true, issues: [] };
  },

  async plan(input: unknown): Promise<readonly OnboardingOperation[]> {
    const cfg = (input ?? {}) as Readonly<Record<string, unknown>>;
    return [{
      id: randomId('op'),
      kind: 'integration.configure',
      capability: 'integration',
      order: 90,
      input: cfg,
      optional: true,
    }];
  },
};

/**
 * ONB-023 — Diagnostics contributor.
 *
 * Configures diagnostics and monitoring during onboarding.
 */
export const diagnosticsContributor: OnboardingContributor = {
  id: 'diagnostics-config',
  capability: 'diagnostics',
  order: 100,
  optional: true,

  async isAvailable(context: OnboardingContext) {
    return context.diagnostics !== undefined;
  },

  async describe(): Promise<OnboardingStepDefinition> {
    return {
      id: 'diagnostics-config',
      title: 'Diagnostics',
      description: 'Configure diagnostics and monitoring',
      capability: 'diagnostics',
      order: 100,
      optional: true,
    };
  },

  async validate(): Promise<OnboardingValidationResult> {
    return { ok: true, issues: [] };
  },

  async plan(input: unknown): Promise<readonly OnboardingOperation[]> {
    const cfg = (input ?? {}) as Readonly<Record<string, unknown>>;
    return [{
      id: randomId('op'),
      kind: 'diagnostics.configure',
      capability: 'diagnostics',
      order: 100,
      input: cfg,
      optional: true,
    }];
  },
};
