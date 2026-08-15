import type { AppConfig } from '../config/schema.js';
import type { Application } from '../bootstrap/application.js';

declare module 'fastify' {
  interface FastifyInstance {
    readonly config: AppConfig;
    readonly application: Application;
  }
}

export {};
