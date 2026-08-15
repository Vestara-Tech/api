import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

function parseOpenApiYaml(source: string): { paths: Record<string, { get?: unknown; post?: unknown }> } {
  // Minimal structural parse: extract `path:` keys and HTTP verbs.
  const paths: Record<string, { get?: unknown; post?: unknown }> = {};
  let currentPath: string | null = null;
  for (const line of source.split('\n')) {
    const pathMatch = line.match(/^  (\/(?:health|api)\/[^\s:]+):$/);
    if (pathMatch) {
      currentPath = pathMatch[1]!;
      paths[currentPath] = {};
      continue;
    }
    if (currentPath) {
      const verbMatch = line.match(/^    (get|post|put|patch|delete):/);
      if (verbMatch) {
        const verb = verbMatch[1] as keyof typeof paths[string];
        paths[currentPath]![verb] = {};
      }
    }
  }
  return { paths };
}

// Compiled tests live under dist/tests/contract; the repo root is three levels up.
const specPath = fileURLToPath(new URL('../../../contracts/openapi/vestara-v2.yaml', import.meta.url));
const spec = readFileSync(specPath, 'utf8');

const IMPLEMENTED_ROUTES = ['/health/live', '/health/ready', '/api/v2', '/api/v2/system'];

test('OpenAPI spec declares every implemented route', () => {
  const parsed = parseOpenApiYaml(spec);
  for (const route of IMPLEMENTED_ROUTES) {
    assert.ok(parsed.paths[route], `missing path in OpenAPI: ${route}`);
    assert.ok(parsed.paths[route]!.get, `missing GET for ${route}`);
  }
});

test('OpenAPI defines the canonical error schema', () => {
  assert.ok(spec.includes('VestaraError'));
  assert.ok(spec.includes('requestId'));
  assert.ok(spec.includes('correlationId'));
  assert.ok(spec.includes('retryable'));
});

test('OpenAPI declares the v2 service identity', () => {
  assert.ok(spec.includes('Vestara API v2'));
  assert.ok(spec.includes('openapi: 3.1.0'));
});
