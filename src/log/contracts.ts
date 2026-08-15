/** LOG-001 — Log contracts. */

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogSource {
  readonly type: 'api' | 'module' | 'service' | 'runtime' | 'agent' | 'workflow' | 'tool' | 'integration' | 'application' | 'os' | 'system';
  readonly id: string;
}

export interface LogError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly cause?: string;
}

export interface LogRecord {
  readonly id: string;
  readonly timestamp: string;
  readonly level: LogLevel;
  readonly message: string;
  readonly source: LogSource;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly spanId?: string;
  readonly organizationId?: string;
  readonly workspaceId?: string;
  readonly workflowId?: string;
  readonly taskId?: string;
  readonly agentId?: string;
  readonly sessionId?: string;
  readonly operationId?: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly error?: LogError;
}

export interface LogQuery {
  readonly level?: LogLevel | readonly LogLevel[];
  readonly sourceId?: string;
  readonly sourceType?: string;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly workflowId?: string;
  readonly agentId?: string;
  readonly messageContains?: string;
  readonly since?: string;
  readonly until?: string;
  readonly limit?: number;
}

export interface LogQueryStats {
  readonly total: number;
  readonly byLevel: Record<LogLevel, number>;
  readonly bySource: Readonly<Record<string, number>>;
}

export interface LogRedactionRule {
  readonly field: string;
  readonly pattern: RegExp;
  readonly replacement: string;
}

/** LOG-002 — logger facade. */
export interface LoggerFacade {
  readonly source: LogSource;
  trace(message: string, attrs?: Readonly<Record<string, unknown>>): void;
  debug(message: string, attrs?: Readonly<Record<string, unknown>>): void;
  info(message: string, attrs?: Readonly<Record<string, unknown>>): void;
  warn(message: string, attrs?: Readonly<Record<string, unknown>>): void;
  error(message: string, attrs?: Readonly<Record<string, unknown>>, error?: Error): void;
  fatal(message: string, attrs?: Readonly<Record<string, unknown>>, error?: Error): void;
  child(source: LogSource): LoggerFacade;
}

export interface LogContext {
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly traceId?: string;
  readonly workflowId?: string;
  readonly agentId?: string;
  readonly operationId?: string;
}
