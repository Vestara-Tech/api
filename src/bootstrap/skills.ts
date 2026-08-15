import type { SkillDefinition } from '../skill/domain/contracts.js';

/**
 * Built-in skills (SKILL-002/003). Skills are portable procedural knowledge;
 * the api-builder skill demonstrates the manifest + workflow pattern.
 */
export function defineBuiltinSkills(): readonly SkillDefinition[] {
  return [
    {
      id: 'vestara-planning',
      version: '1.0.0',
      name: 'Planning',
      description: 'Break work into an ordered, observable plan.',
      instructions: 'Understand the request, inspect current state, produce an ordered plan with owner agents, dependencies, and verification steps. Never execute mutations.',
      requiredCapabilities: ['workflow.plan'],
      compatibleRoles: ['planner'],
    },
    {
      id: 'vestara-api-builder',
      version: '1.0.0',
      name: 'API Builder',
      description: 'Turn a feature/API request into a governed API definition.',
      instructions: 'Understand the request. Inspect existing API definitions. Create a proposal (resources, fields, relations, endpoints). Validate. Analyze compatibility. Preview. Request approval before publishing.',
      requiredCapabilities: ['builder.definition.read', 'builder.definition.create', 'builder.definition.validate', 'builder.definition.preview'],
      optionalCapabilities: ['ai.generate', 'generator.plan'],
      compatibleRoles: ['developer', 'specialist'],
    },
    {
      id: 'typescript-development',
      version: '1.0.0',
      name: 'TypeScript Development',
      description: 'Write idiomatic TypeScript with the repository conventions.',
      instructions: 'Follow the repository conventions: single quotes, trailing commas, semicolons, verbatimModuleSyntax for type-only re-exports, exactOptionalPropertyTypes with conditional spreads. Run lint and typecheck before finishing.',
      requiredCapabilities: ['repo.read'],
      compatibleRoles: ['developer'],
    },
    {
      id: 'testing',
      version: '1.0.0',
      name: 'Testing',
      description: 'Write and run tests with Vitest.',
      instructions: 'Locate existing tests under __tests__ directories. Mirror their style. Run the focused test file and the full suite before finishing.',
      requiredCapabilities: ['repo.test'],
      compatibleRoles: ['developer', 'verifier'],
    },
    {
      id: 'vestara-code-review',
      version: '1.0.0',
      name: 'Code Review',
      description: 'Review implementations for correctness, security and style.',
      instructions: 'Review the changes against the requirements. Check for correctness, security issues, and style drift. Recommend changes; never modify code.',
      requiredCapabilities: ['repo.read'],
      compatibleRoles: ['reviewer'],
    },
    {
      id: 'vestara-verification',
      version: '1.0.0',
      name: 'Verification',
      description: 'Prove correctness via evidence.',
      instructions: 'Prove correctness via evidence: run the relevant checks, record outputs, and only accept verifiable results. Never think, never review.',
      requiredCapabilities: ['repo.test'],
      compatibleRoles: ['verifier'],
    },
  ];
}
