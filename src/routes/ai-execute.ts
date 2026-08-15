import type { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox';
import { Type } from '@sinclair/typebox';
import type { AiService } from '../ai/runtime/ai-runtime.js';
import {
  AiGenerateRequestSchema,
  AiGenerateResultSchema,
  AiStreamEventSchema,
} from '../ai/contracts.js';

const AiErrorSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
    requestId: Type.String(),
    correlationId: Type.String(),
    retryable: Type.Boolean(),
    details: Type.Optional(Type.Any()),
  }),
});

/**
 * AI — Generate/stream execution bridges. The AI Experience UI (packages/ai-ui
 * via the Vestara assistant runtime) consumes these. `/stream` returns
 * Server-Sent Events of the normalized `AiStreamEvent` vocabulary.
 */
export const aiExecuteRoutes: FastifyPluginAsyncTypebox = async (app) => {
  const ai = app.application.container.resolve<AiService>('ai');

  app.post(
    '/api/v2/ai/generate',
    {
      schema: {
        tags: ['ai'],
        summary: 'Generate a non-streaming AI response',
        body: AiGenerateRequestSchema,
        response: { 200: AiGenerateResultSchema, 500: AiErrorSchema },
      },
    },
    async (request, reply) => {
      try {
        const result = await ai.generate(request.body as never);
        return reply.send(result as never);
      } catch (err) {
        return reply.status(500).send({
          error: { code: 'AI_ERROR', message: (err as Error).message, requestId: request.id, correlationId: 'ai', retryable: false },
        } as never);
      }
    },
  );

  app.post(
    '/api/v2/ai/stream',
    {
      schema: {
        tags: ['ai'],
        summary: 'Stream an AI response as Server-Sent Events',
        body: AiGenerateRequestSchema,
        response: { 200: Type.Union([AiStreamEventSchema]), 500: AiErrorSchema },
      },
    },
    async (request, reply) => {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      const encoder = new TextEncoder();
      const send = (event: unknown): void => {
        reply.raw.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        for await (const event of ai.stream(request.body as never)) {
          send(event);
        }
      } catch (err) {
        send({ type: 'error', message: (err as Error).message });
      } finally {
        reply.raw.end();
      }
    },
  );
};
