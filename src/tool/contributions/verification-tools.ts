import type { ToolContribution } from '../domain/contracts.js';
import { readLatestVerificationReport, runVerificationCommand } from '../../verification/index.js';

export function verificationToolContributions(): readonly ToolContribution[] {
  return [
    {
      toolId: 'verification.latest',
      version: '1',
      description: 'Read the latest FASTVERIFY report and evidence from the current repository state',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      outputSchema: { type: 'object' },
      capabilities: ['verification.read'],
      risk: 'read',
      handler: async () => {
        const report = readLatestVerificationReport();
        if (!report) {
          return { ok: false, error: 'No verification report available yet' };
        }
        return { ok: true, report };
      },
    },
    {
      toolId: 'verification.run',
      version: '1',
      description: 'Run the current verification control plane and return the latest report',
      inputSchema: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: ['static', 'affected', 'module', 'platform'] },
          moduleName: { type: 'string' },
          noCache: { type: 'boolean' },
        },
        additionalProperties: false,
      },
      outputSchema: { type: 'object' },
      capabilities: ['verification.run'],
      risk: 'write',
      handler: async (_context, input) => {
        const payload = (input ?? {}) as { scope?: 'static' | 'affected' | 'module' | 'platform'; moduleName?: string; noCache?: boolean };
        const result = runVerificationCommand({
          ...(payload.scope !== undefined ? { scope: payload.scope } : {}),
          ...(payload.moduleName !== undefined ? { moduleName: payload.moduleName } : {}),
          ...(payload.noCache === true ? { noCache: true } : {}),
        });
        return {
          ok: result.ok,
          exitCode: result.exitCode,
          output: result.output,
          report: result.report,
          reportPath: result.reportPath,
          fingerprint: result.fingerprint,
        };
      },
    },
  ];
}
