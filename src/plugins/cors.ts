import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

/**
 * Browser apps (workspace, builder UIs) run on their own dev servers and call
 * the API cross-origin (e.g. Vite on :5175 -> API on :4310). Without CORS
 * headers the browser blocks those responses with a NetworkError even though
 * the API is reachable. Auth uses an Authorization bearer header (no cookies),
 * so no credentials mode is needed and reflecting any origin is safe for the
 * local-first API.
 */
export async function registerCors(app: FastifyInstance): Promise<void> {
  await app.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'X-Request-ID', 'X-Correlation-ID'],
  });
}
