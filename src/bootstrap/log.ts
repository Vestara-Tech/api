import { InMemoryLogStore } from '../log/store/in-memory.js';
import { LogService } from '../log/service/log-service.js';

export interface LogPlatformOptions {
  readonly store?: InMemoryLogStore;
}

export interface LogPlatform {
  readonly store: InMemoryLogStore;
  readonly service: LogService;
}

/** LOG — Composition root. Defaults to the in-memory store. */
export function buildLogPlatform(options: LogPlatformOptions = {}): LogPlatform {
  const store = options.store ?? new InMemoryLogStore();
  const service = new LogService({ store });
  return { store, service };
}
