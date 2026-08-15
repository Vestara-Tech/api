import { randomId } from '../../core/identifiers.js';
import type { LogContext, LogLevel, LogRecord, LogSource, LoggerFacade } from '../contracts.js';
import type { LogStore } from '../store/log-store.js';
import { LogRedactor } from '../redaction/redactor.js';

export interface LogServiceOptions {
  readonly store: LogStore;
  readonly redactor?: LogRedactor;
}

/**
 * LOG-002/004/005 — Vestara LogService. Collects, normalizes, correlates,
 * redacts and stores operational logs. Pino remains the Node implementation;
 * this is the Vestara contract around it.
 */
export class LogService {
  private readonly store: LogStore;
  private readonly redactor: LogRedactor;
  private readonly sources = new Set<string>();
  private readonly context: LogContext;

  constructor(options: LogServiceOptions, context: LogContext = {}) {
    this.store = options.store;
    this.redactor = options.redactor ?? new LogRedactor();
    this.context = context;
  }

  emit(level: LogLevel, source: LogSource, message: string, attrs: Readonly<Record<string, unknown>> = {}, error?: Error): LogRecord {
    this.sources.add(source.id);
    const record: LogRecord = {
      id: randomId('log'),
      timestamp: new Date().toISOString(),
      level,
      message,
      source,
      ...(this.context.requestId !== undefined ? { requestId: this.context.requestId } : {}),
      ...(this.context.correlationId !== undefined ? { correlationId: this.context.correlationId } : {}),
      ...(this.context.traceId !== undefined ? { traceId: this.context.traceId } : {}),
      ...(this.context.workflowId !== undefined ? { workflowId: this.context.workflowId } : {}),
      ...(this.context.agentId !== undefined ? { agentId: this.context.agentId } : {}),
      ...(this.context.operationId !== undefined ? { operationId: this.context.operationId } : {}),
      attributes: attrs,
      ...(error !== undefined ? { error: { name: error.name, message: error.message } } : {}),
    };
    this.store.append(this.redactor.redactRecord(record));
    return record;
  }

  logger(source: LogSource): LoggerFacade {
    return this.facadeFor(source);
  }

  private facadeFor(source: LogSource): LoggerFacade {
    return {
      source,
      trace: (m, a) => void this.emit('trace', source, m, a),
      debug: (m, a) => void this.emit('debug', source, m, a),
      info: (m, a) => void this.emit('info', source, m, a),
      warn: (m, a) => void this.emit('warn', source, m, a),
      error: (m, a, e) => void this.emit('error', source, m, a, e),
      fatal: (m, a, e) => void this.emit('fatal', source, m, a, e),
      child: (childSource) => this.facadeFor(childSource),
    };
  }

  listSources(): readonly string[] {
    return [...this.sources].sort();
  }
}
