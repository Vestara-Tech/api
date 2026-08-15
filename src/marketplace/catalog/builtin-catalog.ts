import type { VestaraPackage } from '../contracts/package.js';

function base(overrides: Partial<VestaraPackage> & Pick<VestaraPackage, 'id' | 'name' | 'version' | 'kind'>): VestaraPackage {
  return {
    publisher: { id: 'vestara', name: 'Vestara', verified: true },
    manifest: {
      schemaVersion: '1',
      id: overrides.id,
      name: overrides.name,
      version: overrides.version,
      kind: overrides.kind,
      publisher: 'vestara',
      vestara: { api: '>=2.0.0', platform: '>=1.0.0' },
    },
    dependencies: [],
    permissions: [],
    capabilities: [],
    compatibility: { apiRange: '>=2.0.0', platformRange: '>=1.0.0' },
    artifacts: [],
    provenance: { source: 'builtin', verified: true, publishedAt: '2026-01-01T00:00:00.000Z' },
    installs: 0,
    rating: 4.9,
    ...overrides,
  };
}

/** MKT-006 — Bundled catalog, available offline. */
export function builtinCatalog(): readonly VestaraPackage[] {
  return [
    base({
      id: 'com.vestara.github',
      name: 'GitHub Integration',
      version: '2.4.1',
      kind: 'integration',
      permissions: [
        { id: 'repository.read', required: true },
        { id: 'repository.write', required: false },
        { id: 'pull-request.create', required: false },
        { id: 'workflow.execute', required: false, approval: 'explicit' },
      ],
      capabilities: [
        { id: 'integration.github.repository', name: 'Repository discovery' },
        { id: 'integration.github.pull-request', name: 'Pull requests' },
        { id: 'tool.github.create-pr', name: 'Create PR tool' },
      ],
      dependencies: [{ packageId: 'vestara.integration', versionRange: '>=2.0.0', required: true }],
      installs: 12000,
      rating: 4.9,
    }),
    base({ id: 'com.vestara.developer-agent', name: 'Developer Agent', version: '1.8.0', kind: 'agent' }),
    base({ id: 'com.vestara.reviewer-agent', name: 'Reviewer Agent', version: '1.3.0', kind: 'agent' }),
    base({ id: 'com.vestara.typescript-skill', name: 'TypeScript Engineering', version: '2.0.0', kind: 'skill' }),
    base({ id: 'com.vestara.git-tools', name: 'Git Tools', version: '1.2.0', kind: 'tool' }),
    base({ id: 'com.vestara.playwright-tool', name: 'Playwright', version: '1.0.0', kind: 'tool' }),
    base({ id: 'com.vestara.engineering-workflow', name: 'Engineering Feature Workflow', version: '1.0.0', kind: 'workflow' }),
    base({ id: 'com.vestara.postgresql-provider', name: 'PostgreSQL Provider', version: '3.1.2', kind: 'database-provider' }),
    base({
      id: 'com.vestara.fullstack-pack',
      name: 'Full-Stack Engineering Pack',
      version: '1.0.0',
      kind: 'standards-pack',
      dependencies: [
        { packageId: 'com.vestara.developer-agent', versionRange: '>=1.0.0', required: true },
        { packageId: 'com.vestara.reviewer-agent', versionRange: '>=1.0.0', required: true },
        { packageId: 'com.vestara.typescript-skill', versionRange: '>=1.0.0', required: true },
        { packageId: 'com.vestara.git-tools', versionRange: '>=1.0.0', required: true },
        { packageId: 'com.vestara.playwright-tool', versionRange: '>=1.0.0', required: true },
        { packageId: 'com.vestara.engineering-workflow', versionRange: '>=1.0.0', required: true },
      ],
    }),
    base({ id: 'com.vestara.database-toolkit', name: 'Database Toolkit', version: '1.1.0', kind: 'module' }),
    base({ id: 'com.vestara.api-builder-pack', name: 'API Builder Pack', version: '1.0.0', kind: 'builder' }),
  ];
}
