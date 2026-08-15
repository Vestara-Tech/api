import { describe, expect, it } from 'vitest';
import { AiModelCatalog } from '../../src/ai/catalog/model-catalog.js';
import { AiProviderRegistry } from '../../src/ai/providers/provider-registry.js';
import { OpenAiCompatibleAdapter } from '../../src/ai/providers/openai-compatible.js';
import {
  buildAiPlatformV2,
  defaultAiProfiles,
  providerState,
  healthScore,
  isProviderUsable,
  InMemoryAiProviderState,
  type AiProfile,
} from '../../src/ai/v2/index.js';

function catalog() {
  const catalog = new AiModelCatalog();
  catalog.upsert({ id: 'gpt-4o', providerId: 'openai', name: 'GPT-4o', capabilities: { reasoning: true, tools: true, structuredOutput: true, functionCalling: true, vision: true, embeddings: false, streaming: true }, modalities: ['text', 'image'], contextWindow: 128000, maxOutputTokens: 16000, pricing: { inputPerMillion: 2.5, outputPerMillion: 10 }, openWeight: false, lifecycleStatus: 'ga' });
  catalog.upsert({ id: 'gpt-4o-mini', providerId: 'openai', name: 'GPT-4o mini', capabilities: { reasoning: false, tools: true, structuredOutput: true, functionCalling: true, vision: true, embeddings: false, streaming: true }, modalities: ['text', 'image'], contextWindow: 128000, maxOutputTokens: 16000, pricing: { inputPerMillion: 0.15, outputPerMillion: 0.6 }, openWeight: false, lifecycleStatus: 'ga' });
  catalog.upsert({ id: 'qwen-coder', providerId: 'ollama', name: 'Qwen Coder', capabilities: { reasoning: false, tools: true, structuredOutput: true, functionCalling: true, vision: false, embeddings: false, streaming: true }, modalities: ['text'], contextWindow: 64000, maxOutputTokens: 16000, openWeight: true, lifecycleStatus: 'ga' });
  return catalog;
}

function providers() {
  const registry = new AiProviderRegistry();
  registry.register({ provider: { id: 'openai', name: 'OpenAI', type: 'openai-compatible', enabled: true, priority: 10, apiEndpoint: 'https://api.openai.com/v1' }, adapter: new OpenAiCompatibleAdapter('openai', 'https://api.openai.com/v1', '') });
  registry.register({ provider: { id: 'ollama', name: 'Ollama', type: 'local', enabled: true, priority: 50, apiEndpoint: 'http://localhost:11434/v1' }, adapter: new OpenAiCompatibleAdapter('ollama', 'http://localhost:11434/v1', '') });
  return registry;
}

function makePlatform(overrides: { providerStates?: { openai?: boolean; ollama?: boolean } } = {}) {
  const cat = catalog();
  const reg = providers();
  const states = new InMemoryAiProviderState();
  const openai = overrides.providerStates?.openai ?? true;
  const ollama = overrides.providerStates?.ollama ?? true;
  states.upsert({ id: 'openai', name: 'OpenAI', installed: true, configured: true, enabled: openai, health: 'healthy' });
  states.upsert({ id: 'ollama', name: 'Ollama', installed: true, configured: true, enabled: ollama, health: 'healthy' });
  return buildAiPlatformV2({ catalog: cat, providers: reg, providerStates: states.listProviderStates() });
}

describe('AI2-001 profiles', () => {
  it('ships default profiles with strategies and requirements', () => {
    const profiles = defaultAiProfiles();
    const ids = profiles.map((p) => p.id);
    expect(ids).toContain('vestara.reasoning');
    expect(ids).toContain('vestara.coding');
    expect(ids).toContain('vestara.fast');
    expect(ids).toContain('vestara.embedding');
    const coding = profiles.find((p) => p.id === 'vestara.coding')!;
    expect(coding.requirements.minContext).toBeGreaterThan(0);
    expect(coding.strategy).toBe('balanced');
  });

  it('stores and lists profiles', () => {
    const platform = buildAiPlatformV2({ catalog: catalog(), providers: providers() });
    expect(platform.profiles.list().length).toBeGreaterThanOrEqual(7);
    platform.profiles.save({ id: 'custom.fast', name: 'Custom Fast', requirements: {}, strategy: 'lowest-latency', parameters: {}, tags: [] });
    expect(platform.profiles.get('custom.fast')!.name).toBe('Custom Fast');
  });
});

describe('AI2-002 provider lifecycle states', () => {
  it('computes installed/configured/enabled states', () => {
    expect(providerState({ id: 'p', name: 'P', installed: true, configured: false, enabled: false, health: 'unknown' })).toBe('installed');
    expect(providerState({ id: 'p', name: 'P', installed: true, configured: true, enabled: false, health: 'unknown' })).toBe('configured');
    expect(providerState({ id: 'p', name: 'P', installed: true, configured: true, enabled: true, health: 'unknown' })).toBe('enabled');
  });

  it('scores health and usability', () => {
    expect(healthScore('healthy')).toBe(0);
    expect(healthScore('offline')).toBe(3);
    expect(isProviderUsable({ id: 'p', name: 'P', installed: true, configured: true, enabled: true, health: 'healthy' })).toBe(true);
    expect(isProviderUsable({ id: 'p', name: 'P', installed: true, configured: true, enabled: true, health: 'offline' })).toBe(false);
    expect(isProviderUsable({ id: 'p', name: 'P', installed: true, configured: true, enabled: false, health: 'healthy' })).toBe(false);
  });
});

describe('AI2-006..010 routing engine', () => {
  it('routes a profile to the best candidate by strategy', () => {
    const platform = makePlatform();
    const coding = platform.profiles.get('vestara.coding')!;
    const decision = platform.router.route(coding);
    expect(decision.profileId).toBe('vestara.coding');
    expect(decision.selectedFrom).toBe('candidate-ranking');
    expect(decision.resolved.modelId).toBeTruthy();
    expect(decision.reason).toContain('balanced');
  });

  it('privacy-first never routes to cloud providers', () => {
    const platform = makePlatform();
    const privacy = platform.profiles.get('vestara.privacy-first')!;
    const decision = platform.router.route(privacy);
    expect(decision.resolved.providerId).toBe('ollama');
    expect(decision.resolved.modelId).toBe('qwen-coder');
  });

  it('local-first prefers open-weight models', () => {
    const platform = makePlatform();
    const local = platform.profiles.get('vestara.local-first')!;
    const decision = platform.router.route(local);
    expect(decision.resolved.providerId).toBe('ollama');
  });

  it('falls back through an explicit chain when primary is disabled', () => {
    const platform = makePlatform({ providerStates: { openai: false } });
    const profile: AiProfile = {
      id: 'test.chain',
      name: 'Chain',
      requirements: {},
      strategy: 'fixed',
      chain: { primary: { providerId: 'openai', modelId: 'gpt-4o' }, fallbacks: [{ providerId: 'ollama', modelId: 'qwen-coder' }], failoverConditions: ['provider-error'] },
      parameters: {},
      tags: [],
    };
    const decision = platform.router.route(profile);
    expect(decision.selectedFrom).toBe('fallback');
    expect(decision.resolved.providerId).toBe('ollama');
  });

  it('throws when no usable model satisfies the profile', () => {
    const platform = makePlatform({ providerStates: { openai: false, ollama: false } });
    const coding = platform.profiles.get('vestara.coding')!;
    expect(() => platform.router.route(coding)).toThrow(/No enabled/);
  });

  it('lists eligible models for a profile', () => {
    const platform = makePlatform();
    const coding = platform.profiles.get('vestara.coding')!;
    const eligible = platform.router.listEligible(coding);
    expect(eligible.length).toBeGreaterThan(0);
    expect(eligible.every((m) => m.contextWindow >= coding.requirements.minContext!)).toBe(true);
  });

  it('health degrades provider ranking', () => {
    const cat = catalog();
    const reg = providers();
    const states = new InMemoryAiProviderState();
    states.upsert({ id: 'openai', name: 'OpenAI', installed: true, configured: true, enabled: true, health: 'offline' });
    states.upsert({ id: 'ollama', name: 'Ollama', installed: true, configured: true, enabled: true, health: 'healthy' });
    const platform = buildAiPlatformV2({ catalog: cat, providers: reg, providerStates: states.listProviderStates() });
    const background = platform.profiles.get('vestara.background')!;
    const decision = platform.router.route(background);
    expect(decision.resolved.providerId).toBe('ollama');
  });
});
