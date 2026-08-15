import type * as http from 'node:http';
import { badRequest, notFound } from '../core/errors.js';

export interface HttpRequest {
  readonly method: string;
  readonly pathname: string;
  readonly url: URL;
  readonly req: http.IncomingMessage;
  readonly params?: Record<string, string>;
}

export interface HttpResponse {
  readonly res: http.ServerResponse;
  json(status: number, body: unknown): void;
  text(status: number, body: string): void;
}

export type RouteHandler = (request: HttpRequest, response: HttpResponse) => Promise<void> | void;

type PathSegment = string | { readonly param: string };

function tokenize(pathname: string): string[] {
  return pathname.split('/').filter((segment) => segment.length > 0);
}

function match(pattern: string, pathname: string): Record<string, string> | null {
  const patternTokens = tokenize(pattern);
  const pathTokens = tokenize(pathname);
  if (patternTokens.length !== pathTokens.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternTokens.length; i += 1) {
    const expected = patternTokens[i]!;
    const actual = pathTokens[i]!;
    if (expected.startsWith(':')) {
      params[expected.slice(1)] = decodeURIComponent(actual);
    } else if (expected !== actual) {
      return null;
    }
  }
  return params;
}

export interface RouterEntry {
  readonly method: string;
  readonly pattern: string;
  readonly handler: RouteHandler;
}

export class Router {
  private readonly entries: RouterEntry[] = [];

  get(pattern: string, handler: RouteHandler): void {
    this.entries.push({ method: 'GET', pattern, handler });
  }

  post(pattern: string, handler: RouteHandler): void {
    this.entries.push({ method: 'POST', pattern, handler });
  }

  put(pattern: string, handler: RouteHandler): void {
    this.entries.push({ method: 'PUT', pattern, handler });
  }

  patch(pattern: string, handler: RouteHandler): void {
    this.entries.push({ method: 'PATCH', pattern, handler });
  }

  delete(pattern: string, handler: RouteHandler): void {
    this.entries.push({ method: 'DELETE', pattern, handler });
  }

  handle(request: HttpRequest, response: HttpResponse): Promise<void> | void {
    for (const entry of this.entries) {
      if (entry.method !== request.method) continue;
      const params = match(entry.pattern, request.pathname);
      if (!params) continue;
      return entry.handler({ ...request, params }, response);
    }
    throw notFound(`No route for ${request.method} ${request.pathname}`);
  }
}

export function sendJson(response: http.ServerResponse, status: number, body: unknown): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(body));
}

export function sendText(response: http.ServerResponse, status: number, body: string): void {
  response.statusCode = status;
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.end(body);
}

export function badRequestBody(message: string): never {
  throw badRequest(message);
}
