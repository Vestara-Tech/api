import type { VerificationConfig } from '../affected.ts';

import type { ParsedVerificationGraph, ParsedVerificationModule } from './types.ts';

export function parseVerificationGraph(config: VerificationConfig): ParsedVerificationGraph {
  const modules: ParsedVerificationModule[] = Object.entries(config.modules)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([id, definition]) => ({
      id,
      sources: [...definition.sources],
      tests: [...definition.tests],
      dependsOn: [...(definition.dependsOn ?? [])],
      cwd: definition.cwd,
    }));

  const aliases = new Map<string, string>(Object.entries(config.aliases ?? {}).sort(([left], [right]) => left.localeCompare(right)));

  return { modules, aliases };
}
