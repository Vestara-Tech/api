import * as http from 'node:http';
import type { AppConfig } from './config/schema.js';
import { createRequestContext, requestContextStore } from './core/context.js';
import { VestaraError, internalError } from './core/errors.js';
import type { Logger } from './infrastructure/logger.js';
import { Router, sendJson, sendText } from './transport/http.js';
import { newRequestId } from './core/identifiers.js';
import type { HttpResponse } from './transport/http.js';

export interface ServerDependencies {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly systemStatus: () => Record<string, unknown>;
}

export class VestaraApiServer {
  private readonly server: http.Server;
  private readonly router = new Router();
  private ready = false;
  private readonly config: AppConfig;
  private readonly logger: Logger;
  private readonly systemStatusFn: () => Record<string, unknown>;

  constructor(deps: ServerDependencies) {
    this.config = deps.config;
    this.logger = deps.logger;
    this.systemStatusFn = deps.systemStatus;

    this.registerRoutes();
    this.server = http.createServer((req, res) => {
      void this.handle(req, res);
    });
  }

  private registerRoutes(): void {
    this.router.get('/health/live', (_req, _res) => {
      sendJson(_res.res, 200, { status: 'live', service: this.config.service });
    });

    this.router.get('/health/ready', (_req, _res) => {
      if (!this.ready) {
        sendJson(_res.res, 503, { status: 'starting', service: this.config.service });
        return;
      }
      sendJson(_res.res, 200, { status: 'ready', service: this.config.service });
    });

    this.router.get('/api/v2/system', (_req, _res) => {
      sendJson(_res.res, 200, {
        service: this.config.service,
        apiVersion: this.config.apiVersion,
        ...this.systemStatusFn(),
      });
    });

    this.router.get('/api/v2', (_req, _res) => {
      sendJson(_res.res, 200, {
        service: this.config.service,
        apiVersion: this.config.apiVersion,
        name: 'Vestara API v2',
      });
    });
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', `http://${this.config.host}:${this.config.port}`);
    const method = (req.method ?? 'GET').toUpperCase();
    const requestId = newRequestId();

    const context = createRequestContext({
      requestId,
      correlationId: String(url.searchParams.get('correlationId') ?? ''),
    });

    this.logger.info('http.request.started', {
      method,
      path: url.pathname,
      requestId: context.requestId,
      correlationId: context.correlationId,
      traceId: context.traceId,
    });

    await requestContextStore.run(context, async () => {
      try {
        const httpResponse: HttpResponse = {
          res,
          json: (status, body) => sendJson(res, status, body),
          text: (status, body) => sendText(res, status, body),
        };
        this.router.handle({ method, pathname: url.pathname, url, req }, httpResponse);
      } catch (err) {
        this.writeError(res, err, context.requestId, context.correlationId);
      }
    });
  }

  private writeError(res: http.ServerResponse, err: unknown, requestId: string, correlationId: string): void {
    const normalized = err instanceof VestaraError ? err : internalError();
    if (!(err instanceof VestaraError)) {
      this.logger.error('http.request.failed', {
        requestId,
        correlationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    res.statusCode = normalized.status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: {
          code: normalized.code,
          message: normalized.message,
          requestId,
          correlationId,
          retryable: normalized.retryable,
          details: normalized.details,
        },
      }),
    );
  }

  setReady(ready: boolean): void {
    this.ready = ready;
  }

  listen(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.config.port, this.config.host, () => {
        this.ready = true;
        this.logger.info('http.server.listening', {
          host: this.config.host,
          port: this.config.port,
        });
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    this.ready = false;
    await new Promise<void>((resolve) => this.server.close(() => resolve()));
  }
}
