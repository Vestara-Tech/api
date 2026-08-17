import type { DocsTarget } from './platform-summary.js';

export const DEFAULT_DOC_TARGETS: readonly DocsTarget[] = ['summary', 'readme'];

export function parseDocsTargets(argv: readonly string[]): readonly DocsTarget[] {
  const flag = argv.find((entry) => entry.startsWith('--targets='));
  const value = flag?.slice('--targets='.length);
  if (!value) return DEFAULT_DOC_TARGETS;
  const targets = value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean) as DocsTarget[];
  return targets.length > 0 ? targets : DEFAULT_DOC_TARGETS;
}
