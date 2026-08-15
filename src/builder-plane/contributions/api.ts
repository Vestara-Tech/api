import type { ApiDefinition } from '../../builder/domain/types.js';
import { DefinitionValidator } from '../../builder/domain/validator.js';
import { CompatibilityAnalyzer } from '../../builder/domain/compatibility.js';
import type { BuilderContribution } from '../contracts.js';
import type { CompatibilityChange } from '../compatibility.js';

const validator = new DefinitionValidator();

/**
 * BLD-X19 — API Builder migrated onto the generic Builder Plane. The spec is
 * the real ApiDefinition; validation + compatibility reuse the existing
 * domain logic. Proves the abstraction against actual existing code.
 */
export const apiBuilderContribution: BuilderContribution<ApiDefinition> = {
  id: 'builder.api',
  moduleId: 'builder',
  kind: 'api',
  version: '1.0.0',
  schema: { type: 'object' },
  capabilities: ['builder.api', 'builder.contract'],
  validator: {
    validate: (spec) => {
      const result = validator.validate(spec);
      return { ok: result.ok, issues: result.issues };
    },
  },
  compiler: {
    compile: (spec) => spec,
  },
  generatorCapabilities: ['api.resource', 'api.endpoint'],
  preferredEditor: 'canvas',
};

export function apiComparator(candidate: ApiDefinition, baseline: ApiDefinition): readonly CompatibilityChange[] {
  const analyzer = new CompatibilityAnalyzer();
  const result = analyzer.analyze(candidate, baseline);
  return result.changes.map((c) => ({ kind: c.kind, path: c.path, severity: c.severity, message: c.message }));
}
