/**
 * Minimal glob matching for verification path patterns.
 * Supports `**` (any depth), `*` (within a path segment), and `?` (single char).
 * Zero-dependency; used for module source/test mapping in impact analysis.
 */
export function globToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const body = escaped
    .replace(/\*\*\/+/g, '\u0001')
    .replace(/\*\*/g, '\u0002')
    .replace(/\*/g, '[^/]*')
    .replace(/\?/g, '.')
    .replace(/\u0001/g, '(?:.*/)?')
    .replace(/\u0002/g, '.*');
  return new RegExp(`^${body}$`);
}

export function matchGlob(pattern: string, path: string): boolean {
  return globToRegExp(pattern).test(path);
}

export function matchAnyGlob(patterns: string[], path: string): boolean {
  return patterns.some((pattern) => matchGlob(pattern, path));
}