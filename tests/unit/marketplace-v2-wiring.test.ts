import { describe, expect, it } from 'vitest';
import { ContributionRegistryV2 } from '../../src/marketplace/v2/contributions.js';
import { registerPlatformContributions } from '../../src/marketplace/v2/wiring.js';

describe('MKT2-006 configuration contributions', () => {
  it('registers configuration packages as distributable services', () => {
    const registry = new ContributionRegistryV2();
    registerPlatformContributions(registry, {
      configurationContributions: [{ packageId: 'vestara.database', namespace: 'database' }],
    });
    const provides = registry.provides('service');
    expect(provides.some((p) => p.id === 'vestara.database')).toBe(true);
    expect(registry.contributions()).toHaveLength(1);
  });
});

describe('MKT2-007 AI provider/profile/evaluator contributions', () => {
  it('registers AI providers, profiles and evaluators separately', () => {
    const registry = new ContributionRegistryV2();
    registerPlatformContributions(registry, {
      aiProviders: [{ id: 'openai', name: 'OpenAI', enabled: true }],
      aiProfiles: [{ id: 'vestara.coding', name: 'Coding' }],
      aiEvaluators: [{ id: 'schema', name: 'Schema' }],
    });
    expect(registry.provides('ai-provider').map((p) => p.id)).toContain('openai');
    expect(registry.provides('ai-profile').map((p) => p.id)).toContain('vestara.coding');
    expect(registry.provides('evaluator').map((p) => p.id)).toContain('schema');
    expect(registry.contributions()).toHaveLength(3);
  });
});

describe('MKT2-008 builder/generator contributions', () => {
  it('registers builders and generators', () => {
    const registry = new ContributionRegistryV2();
    registerPlatformContributions(registry, {
      builders: [{ kind: 'api', moduleId: 'api-builder', version: '1.0.0' }],
      generators: [{ id: 'generator.api.typescript', capabilities: ['generator.api'] }],
    });
    const builders = registry.provides('api-builder');
    expect(builders.some((b) => b.id === 'api-builder.api')).toBe(true);
    expect(registry.provides('generator').map((g) => g.id)).toContain('generator.api.typescript');
  });
});

describe('MKT2-009 UI component/theme/template contributions', () => {
  it('registers components, themes and templates', () => {
    const registry = new ContributionRegistryV2();
    registerPlatformContributions(registry, {
      components: [{ id: 'button', name: 'Button' }],
      themes: [{ id: 'vestara.dark', name: 'Vestara Dark' }],
      templates: [{ id: 'tpl.dashboard', name: 'Dashboard', kind: 'dashboard' }],
    });
    expect(registry.provides('component').map((c) => c.id)).toContain('button');
    expect(registry.provides('theme').map((t) => t.id)).toContain('vestara.dark');
    expect(registry.provides('template').map((t) => t.id)).toContain('tpl.dashboard');
    expect(registry.contributions()).toHaveLength(3);
  });
});

describe('MKT2-010 OS/image contributions', () => {
  it('registers OS components and image profiles', () => {
    const registry = new ContributionRegistryV2();
    registerPlatformContributions(registry, {
      osComponents: [{ id: 'systemd', name: 'systemd' }],
      imageProfiles: [{ id: 'vestara-desktop', version: '1.0.0' }],
    });
    expect(registry.provides('os-component').map((c) => c.id)).toContain('systemd');
    expect(registry.provides('image-profile').map((p) => p.id)).toContain('vestara-desktop');
  });
});

describe('MKT2 platform contribution wiring end-to-end', () => {
  it('registers every platform module family with the manifest requires', () => {
    const registry = new ContributionRegistryV2();
    registerPlatformContributions(registry, {
      configurationContributions: [{ packageId: 'vestara.database', namespace: 'database' }],
      aiProviders: [{ id: 'openai', name: 'OpenAI' }],
      aiProfiles: [{ id: 'vestara.coding', name: 'Coding' }],
      aiEvaluators: [{ id: 'schema' }],
      builders: [{ kind: 'api', moduleId: 'api-builder', version: '1.0.0' }],
      generators: [{ id: 'generator.api.typescript' }],
      components: [{ id: 'button', name: 'Button' }],
      themes: [{ id: 'vestara.light', name: 'Vestara Light' }],
      templates: [{ id: 'tpl.dashboard', name: 'Dashboard', kind: 'dashboard' }],
      osComponents: [{ id: 'systemd', name: 'systemd' }],
      imageProfiles: [{ id: 'vestara-desktop', version: '1.0.0' }],
    });
    const contributions = registry.contributions();
    expect(contributions).toHaveLength(11);
    for (const c of contributions) {
      expect(c.manifest.requires).toEqual([{ module: 'platform', capability: 'platform.runtime' }]);
      expect(c.manifest.provides.length).toBeGreaterThan(0);
    }
  });
});
