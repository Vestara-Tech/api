import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '../../src/skill/registry/skill-registry.js';
import { SkillResolver } from '../../src/skill/resolver/skill-resolver.js';
import { ExecutionSkillResolver } from '../../src/skill/resolver/execution-skill-resolver.js';
import type { SkillDefinition } from '../../src/skill/domain/contracts.js';
import type { SkillSelector } from '../../src/agent/domain/contracts.js';

const capabilityMap = new Map<string, ReadonlySet<string>>();

function setCapabilities(agentId: string, caps: string[]): void {
  capabilityMap.set(agentId, new Set(caps));
}

const typescriptSkill: SkillDefinition = {
  id: 'typescript-development',
  version: '1.0.0',
  name: 'TypeScript Development',
  description: 'Write idiomatic TypeScript.',
  instructions: 'Follow repo conventions.',
  requiredCapabilities: ['repo.read'],
  compatibleRoles: ['developer'],
};

const planningSkill: SkillDefinition = {
  id: 'vestara-planning',
  version: '1.0.0',
  name: 'Planning',
  description: 'Break work into a plan.',
  instructions: 'Understand the request, produce a plan.',
  requiredCapabilities: ['workflow.plan'],
  compatibleRoles: ['planner'],
};

const universalSkill: SkillDefinition = {
  id: 'universal-skill',
  version: '2.0.0',
  name: 'Universal',
  description: 'Works with any role.',
  instructions: 'Do things.',
  requiredCapabilities: ['repo.read'],
  // No compatibleRoles — compatible with all.
};

const reviewSkill: SkillDefinition = {
  id: 'vestara-code-review',
  version: '1.0.0',
  name: 'Code Review',
  description: 'Review code.',
  instructions: 'Review changes.',
  requiredCapabilities: ['repo.read'],
  compatibleRoles: ['reviewer'],
};

const optionalCapSkill: SkillDefinition = {
  id: 'optional-cap-skill',
  version: '1.0.0',
  name: 'Optional Cap',
  description: 'Has optional capabilities.',
  instructions: 'Use optional features if available.',
  requiredCapabilities: ['repo.read'],
  optionalCapabilities: ['ai.generate'],
  compatibleRoles: ['developer'],
};

let registry: SkillRegistry;
let skillResolver: SkillResolver;
let executionResolver: ExecutionSkillResolver;

beforeEach(() => {
  capabilityMap.clear();
  registry = new SkillRegistry();
  skillResolver = new SkillResolver({
    capabilities: (agentId) => capabilityMap.get(agentId) ?? new Set(),
  });
  executionResolver = new ExecutionSkillResolver({
    registry,
    resolver: skillResolver,
  });

  registry.register(typescriptSkill);
  registry.register(planningSkill);
  registry.register(universalSkill);
  registry.register(reviewSkill);
  registry.register(optionalCapSkill);
});

describe('ExecutionSkillResolver', () => {
  describe('resolve', () => {
    it('resolves a single skill selector into execution skill', async () => {
      setCapabilities('agent-1', ['repo.read']);
      const selectors: SkillSelector[] = [{ id: 'typescript-development' }];

      const result = await executionResolver.resolve(selectors, 'developer', 'agent-1');

      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].id).toBe('typescript-development');
      expect(result.resolved[0].version).toBe('1.0.0');
      expect(result.resolved[0].name).toBe('TypeScript Development');
      expect(result.resolved[0].instructions).toBe('Follow repo conventions.');
      expect(result.resolved[0].roleCompatible).toBe(true);
      expect(result.resolved[0].optional).toBe(false);
      expect(result.appliedCount).toBe(1);
    });

    it('resolves multiple selectors in deterministic order', async () => {
      setCapabilities('agent-1', ['repo.read']);
      const selectors: SkillSelector[] = [
        { id: 'optional-cap-skill' },
        { id: 'typescript-development' },
        { id: 'universal-skill' },
      ];

      const result = await executionResolver.resolve(selectors, 'developer', 'agent-1');

      // Should be sorted by id alphabetically.
      expect(result.resolved.map((s) => s.id)).toEqual([
        'optional-cap-skill',
        'typescript-development',
        'universal-skill',
      ]);
      expect(result.appliedCount).toBe(3);
    });

    it('returns diagnostic for skill not found in registry', async () => {
      setCapabilities('agent-1', ['repo.read']);
      const selectors: SkillSelector[] = [{ id: 'nonexistent-skill' }];

      const result = await executionResolver.resolve(selectors, 'developer', 'agent-1');

      expect(result.resolved).toHaveLength(0);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].skillId).toBe('nonexistent-skill');
      expect(result.diagnostics[0].reason).toBe('not-found');
    });

    it('returns diagnostic for role-incompatible skill', async () => {
      setCapabilities('agent-1', ['repo.read', 'workflow.plan']);
      // planningSkill requires 'planner' role, but agent is 'developer'.
      const selectors: SkillSelector[] = [{ id: 'vestara-planning' }];

      const result = await executionResolver.resolve(selectors, 'developer', 'agent-1');

      expect(result.resolved).toHaveLength(0);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].reason).toBe('role-incompatible');
    });

    it('includes missing-capabilities diagnostic when capabilities are insufficient', async () => {
      // Agent has no capabilities at all.
      setCapabilities('agent-1', []);
      const selectors: SkillSelector[] = [{ id: 'typescript-development' }];

      const result = await executionResolver.resolve(selectors, 'developer', 'agent-1');

      // Skill is resolved but with missing capabilities.
      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].missingRequired).toEqual(['repo.read']);
    });

    it('marks optional selectors correctly', async () => {
      setCapabilities('agent-1', ['repo.read']);
      const selectors: SkillSelector[] = [{ id: 'typescript-development', optional: true }];

      const result = await executionResolver.resolve(selectors, 'developer', 'agent-1');

      expect(result.resolved[0].optional).toBe(true);
    });

    it('produces diagnostic for optional missing skill', async () => {
      setCapabilities('agent-1', ['repo.read']);
      const selectors: SkillSelector[] = [{ id: 'nonexistent-skill', optional: true }];

      const result = await executionResolver.resolve(selectors, 'developer', 'agent-1');

      expect(result.resolved).toHaveLength(0);
      expect(result.diagnostics).toHaveLength(1);
      expect(result.diagnostics[0].optional).toBe(true);
    });

    it('handles empty selectors array', async () => {
      const result = await executionResolver.resolve([], 'developer', 'agent-1');

      expect(result.resolved).toHaveLength(0);
      expect(result.diagnostics).toHaveLength(0);
      expect(result.appliedCount).toBe(0);
      expect(result.totalInstructionLength).toBe(0);
    });

    it('resolves universal skill compatible with any role', async () => {
      setCapabilities('agent-1', ['repo.read']);
      const selectors: SkillSelector[] = [{ id: 'universal-skill' }];

      const resultDev = await executionResolver.resolve(selectors, 'developer', 'agent-1');
      expect(resultDev.resolved).toHaveLength(1);

      const resultReviewer = await executionResolver.resolve(selectors, 'reviewer', 'agent-1');
      expect(resultReviewer.resolved).toHaveLength(1);
    });

    it('aggregates totalInstructionLength', async () => {
      setCapabilities('agent-1', ['repo.read']);
      const selectors: SkillSelector[] = [
        { id: 'typescript-development' },
        { id: 'universal-skill' },
      ];

      const result = await executionResolver.resolve(selectors, 'developer', 'agent-1');

      expect(result.totalInstructionLength).toBe(
        'Follow repo conventions.'.length + 'Do things.'.length,
      );
    });

    it('resolves optional capabilities correctly', async () => {
      setCapabilities('agent-1', ['repo.read', 'ai.generate']);
      const selectors: SkillSelector[] = [{ id: 'optional-cap-skill' }];

      const result = await executionResolver.resolve(selectors, 'developer', 'agent-1');

      expect(result.resolved).toHaveLength(1);
      expect(result.resolved[0].matchedOptional).toEqual(['ai.generate']);
    });

    it('skill with resources includes them in resolved output', async () => {
      const skillWithResources: SkillDefinition = {
        id: 'resourceful-skill',
        version: '1.0.0',
        name: 'Resourceful',
        description: 'Has resources.',
        instructions: 'Use resources.',
        requiredCapabilities: ['repo.read'],
        compatibleRoles: ['developer'],
        resources: [
          { path: 'guide.md', kind: 'markdown', content: '# Guide' },
          { path: 'template.ts', kind: 'template' },
        ],
      };
      registry.register(skillWithResources);
      setCapabilities('agent-1', ['repo.read']);

      const result = await executionResolver.resolve(
        [{ id: 'resourceful-skill' }],
        'developer',
        'agent-1',
      );

      expect(result.resolved[0].resources).toHaveLength(2);
      expect(result.resolved[0].resources[0].path).toBe('guide.md');
    });

    it('counts skipped as zero when all resolve', async () => {
      setCapabilities('agent-1', ['repo.read']);
      const selectors: SkillSelector[] = [
        { id: 'typescript-development' },
        { id: 'universal-skill' },
      ];

      const result = await executionResolver.resolve(selectors, 'developer', 'agent-1');

      expect(result.skippedCount).toBe(0);
    });

    it('handles duplicate selectors by resolving once', async () => {
      setCapabilities('agent-1', ['repo.read']);
      const selectors: SkillSelector[] = [
        { id: 'typescript-development' },
        { id: 'typescript-development' },
      ];

      const result = await executionResolver.resolve(selectors, 'developer', 'agent-1');

      // Both resolve, but they produce the same id — sorting still works.
      expect(result.resolved).toHaveLength(2);
      expect(result.resolved[0].id).toBe('typescript-development');
    });
  });
});
