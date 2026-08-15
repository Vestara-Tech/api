/** Typed connectivity classification so the UI can distinguish failure modes. */
export type ApiErrorCode =
  | 'offline'
  | 'not_found'
  | 'forbidden'
  | 'conflict'
  | 'server_error'
  | 'invalid_response'
  | 'http_error'
  | 'timeout';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly requestId?: string;
  readonly retryable: boolean;
  readonly details?: unknown;

  constructor(options: { code: ApiErrorCode; message: string; status?: number; requestId?: string; retryable?: boolean; details?: unknown }) {
    super(options.message);
    this.name = 'ApiError';
    this.code = options.code;
    this.retryable = options.retryable ?? (options.code === 'offline' || options.code === 'server_error' || options.code === 'timeout');
    if (options.status !== undefined) this.status = options.status;
    if (options.requestId !== undefined) this.requestId = options.requestId;
    if (options.details !== undefined) this.details = options.details;
  }
}

export interface ApiErrorBody {
  readonly error?: { code?: string; message?: string; requestId?: string; retryable?: boolean; details?: unknown };
}

export type ApiConnectionStatus = 'unknown' | 'online' | 'degraded' | 'contract-mismatch' | 'offline';

export interface ApiConnectionState {
  readonly status: ApiConnectionStatus;
  readonly message?: string;
  readonly lastAttemptAt?: string;
  readonly capabilities?: readonly string[];
  readonly apiVersion?: string;
  readonly contractVersion?: string;
}

export interface ApiNegotiationResult {
  readonly state: ApiConnectionState;
  readonly contract?: {
    readonly expected: string;
    readonly actual: string | undefined;
    readonly compatible: boolean;
  };
}

export interface ApiHealthResult {
  readonly ok: boolean;
  readonly state: ApiConnectionState;
}

export interface ApiClientOptions {
  readonly apiBase: string;
  readonly timeoutMs?: number;
  /** Expected API contract version; negotiation reports a contract-mismatch when it differs. */
  readonly expectedContractVersion?: string;
}

/** Shared Vestara API client. Distinguishes offline/404/500/invalid/proxy. */
export class ApiClient {
  readonly apiBase: string;
  private readonly timeoutMs: number;
  readonly expectedContractVersion: string | undefined;

  constructor(options: ApiClientOptions) {
    this.apiBase = options.apiBase.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.expectedContractVersion = options.expectedContractVersion;
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set('Accept', 'application/json');
    if (init.body !== undefined) headers.set('Content-Type', 'application/json');

    let response: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        response = await fetch(`${this.apiBase}${path}`, { ...init, headers, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new ApiError({ code: 'timeout', message: `Request timed out after ${this.timeoutMs}ms (${this.apiBase}${path})` });
      }
      throw new ApiError({
        code: 'offline',
        message: `Unable to connect to ${this.apiBase}${path} — ${(err as Error).message}`,
        details: { cause: (err as Error).message },
      });
    }

    if (response.status === 204) return undefined as T;

    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      if (!response.ok) {
        throw new ApiError({ code: classifyStatus(response.status), message: `${response.status} ${response.statusText} (non-JSON response)`, status: response.status });
      }
      throw new ApiError({ code: 'invalid_response', message: 'Response was not valid JSON', status: response.status });
    }

    if (!response.ok) {
      const errBody = body as ApiErrorBody;
      throw new ApiError({
        code: classifyStatus(response.status),
        message: errBody?.error?.message ?? `${response.status} ${response.statusText}`,
        status: response.status,
        ...(errBody?.error?.requestId !== undefined ? { requestId: errBody.error.requestId } : {}),
        ...(errBody?.error?.retryable !== undefined ? { retryable: errBody.error.retryable } : {}),
        ...(errBody?.error?.details !== undefined ? { details: errBody.error.details } : {}),
      });
    }
    return body as T;
  }

  async health(): Promise<ApiHealthResult> {
    try {
      const state = await this.systemState();
      return { ok: true, state };
    } catch (err) {
      const apiError = err as ApiError;
      return {
        ok: false,
        state: {
          status: apiError.code === 'offline' || apiError.code === 'timeout' ? 'offline' : 'degraded',
          message: apiError.message,
          lastAttemptAt: new Date().toISOString(),
        },
      };
    }
  }

  /** Startup preflight: /health -> /api/v2/system -> capability list. */
  async systemState(): Promise<ApiConnectionState> {
    const health = await this.request<{ status?: string }>('/health').catch(() => null);
    const system = await this.request<{ service?: string; apiVersion?: string; contractVersion?: string; capabilities?: readonly string[] }>('/api/v2/system');
    return {
      status: health ? 'online' : 'degraded',
      ...(system.apiVersion !== undefined ? { apiVersion: system.apiVersion } : {}),
      ...(system.contractVersion !== undefined ? { contractVersion: system.contractVersion } : {}),
      ...(system.capabilities !== undefined ? { capabilities: system.capabilities } : {}),
      lastAttemptAt: new Date().toISOString(),
    };
  }

  /**
   * IMG-028 — Contract negotiation. Runs the full startup preflight and
   * classifies the result, including a contract-mismatch state when the
   * server contract version differs from the client's expected version.
   */
  async negotiate(): Promise<ApiNegotiationResult> {
    let state: ApiConnectionState;
    try {
      state = await this.systemState();
    } catch (err) {
      const apiError = err as ApiError;
      return {
        state: {
          status: apiError.code === 'offline' || apiError.code === 'timeout' ? 'offline' : 'degraded',
          message: apiError.message,
          lastAttemptAt: new Date().toISOString(),
        },
      };
    }

    if (!this.expectedContractVersion) {
      return { state: { ...state, status: state.status === 'online' ? 'online' : 'degraded' } };
    }

    const actual = state.contractVersion;
    const compatible = actual === this.expectedContractVersion;
    const mismatch = actual !== undefined && !compatible;
    return {
      state: mismatch
        ? { ...state, status: 'contract-mismatch', message: `Contract mismatch: client expects ${this.expectedContractVersion}, API serves ${actual}` }
        : state,
      contract: { expected: this.expectedContractVersion, actual, compatible },
    };
  }

  hasCapability(state: ApiConnectionState, namespace: string): boolean | undefined {
    if (!state.capabilities) return undefined;
    return state.capabilities.includes(namespace);
  }
}

function classifyStatus(status: number): ApiErrorCode {
  if (status === 404) return 'not_found';
  if (status === 403) return 'forbidden';
  if (status === 409) return 'conflict';
  if (status >= 500) return 'server_error';
  return 'http_error';
}
