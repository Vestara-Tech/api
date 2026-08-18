import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import { readLatestVerificationReport } from '../verification/index.js';

const GraphIssueSchema = Type.Object({
  severity: Type.Union([Type.Literal('error'), Type.Literal('warning'), Type.Literal('info')]),
  code: Type.String(),
  message: Type.String(),
  module: Type.Optional(Type.String()),
  dependency: Type.Optional(Type.String()),
  alias: Type.Optional(Type.String()),
  path: Type.Optional(Type.String()),
});

const VerificationReportSchema = Type.Object({
  version: Type.Literal(1),
  level: Type.String(),
  scope: Type.String(),
  changedFiles: Type.Array(Type.String()),
  affectedModules: Type.Array(Type.String()),
  selectedTests: Type.Array(Type.String()),
  executedTests: Type.Array(Type.String()),
  reusedTests: Type.Array(Type.String()),
  skippedTests: Type.Array(Type.String()),
  passed: Type.Number(),
  failed: Type.Number(),
  cached: Type.Number(),
  escalated: Type.Boolean(),
  escalationReasons: Type.Array(Type.String()),
  durationMs: Type.Number(),
  graphValid: Type.Boolean(),
  graphIssues: Type.Array(GraphIssueSchema),
  result: Type.Union([Type.Literal('pass'), Type.Literal('fail'), Type.Literal('indeterminate')]),
  verified: Type.Boolean(),
  evidence: Type.Union([Type.String(), Type.Null()]),
  reportPath: Type.Optional(Type.String()),
  fingerprint: Type.Optional(Type.Union([Type.String(), Type.Null()])),
});

/**
 * ARX/VCTRL — Verification control-plane projection.
 * Exposes the latest verification report for Activity Room and operations.
 */
export const verificationRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get(
    '/api/v2/verification/latest',
    {
      schema: {
        tags: ['verification'],
        summary: 'Read the latest verification report',
        response: { 200: Type.Union([VerificationReportSchema, Type.Null()]) },
      },
    },
    async (_request, reply) => reply.send(readLatestVerificationReport() as never),
  );
};
