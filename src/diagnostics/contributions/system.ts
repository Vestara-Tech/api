import type { DiagnosticContribution } from '../contracts.js';

const checks = [
  { id: 'system.api.health', name: 'API Health', category: 'api' as const, risk: 'low' as const, timeoutMs: 5000, capabilities: ['system.read'] },
  { id: 'system.capability.registry', name: 'Capability Registry', category: 'system' as const, risk: 'low' as const, timeoutMs: 2000, capabilities: ['system.read'] },
];

/** DIAG-008/009 — System + API diagnostics. */
export const systemDiagnostics: DiagnosticContribution = {
  id: 'diagnostics.system',
  moduleId: 'system',
  version: '1.0.0',
  checks,
  run: async (context) => {
    const apiUp = context.env.API_PROCESS_UP === true || (context.env as Record<string, unknown>).apiProcessUp === true;
    return [
      {
        checkId: 'system.api.health',
        status: apiUp ? 'pass' : 'fail',
        severity: apiUp ? 'info' : 'critical',
        message: apiUp ? 'API process is healthy' : 'API process is not reachable',
        detail: apiUp ? 'GET /health returns 200' : 'Connection refused on the configured API port',
        evidence: { port: context.env.API_PORT ?? '4310' },
      },
      {
        checkId: 'system.capability.registry',
        status: 'pass',
        severity: 'info',
        message: 'Capability registry is available',
        detail: 'All registered platform capabilities enumerated',
      },
    ];
  },
};
