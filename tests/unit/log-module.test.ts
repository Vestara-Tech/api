import { describe, expect, it } from 'vitest';
import { LogService, InMemoryLogStore, LogRedactor } from '../../src/log/index.js';

const api = { type: 'api' as const, id: 'vestara-api' };
const agent = { type: 'agent' as const, id: 'developer-agent' };

function buildService() {
  const store = new InMemoryLogStore();
  const service = new LogService({ store });
  return { store, service };
}

describe('LOG-002/004 logger facade + correlation', () => {
  it('emits normalized records with source identity', () => {
    const { store, service } = buildService();
    const logger = service.logger(api);
    logger.info('request completed', { status: 200, durationMs: 12 });
    const records = store.query({ sourceId: 'vestara-api' });
    expect(records).toHaveLength(1);
    expect(records[0]!.level).toBe('info');
    expect(records[0]!.source.id).toBe('vestara-api');
    expect(records[0]!.attributes.status).toBe(200);
  });

  it('propagates correlation context through records', () => {
    const store = new InMemoryLogStore();
    const service = new LogService({ store }, { correlationId: 'cor_123', workflowId: 'wf_1' });
    service.emit('info', api, 'workflow step');
    const records = store.query({ correlationId: 'cor_123' });
    expect(records).toHaveLength(1);
    expect(records[0]!.workflowId).toBe('wf_1');
  });
});

describe('LOG-005 source registry', () => {
  it('tracks distinct sources', () => {
    const { service } = buildService();
    service.emit('info', api, 'a');
    service.emit('warn', agent, 'b');
    expect(service.listSources()).toEqual(expect.arrayContaining(['vestara-api', 'developer-agent']));
  });
});

describe('LOG-006 redaction pipeline', () => {
  it('redacts secrets from attributes before storage', () => {
    const store = new InMemoryLogStore();
    const service = new LogService({ store });
    service.emit('info', api, 'login', { authorization: 'Bearer abc123def', password: 'hunter2', apiKey: 'sk-1234', safe: 'value' });
    const [record] = store.query({});
    const attrs = record!.attributes as Record<string, string>;
    expect(attrs.authorization).toBe('[REDACTED]');
    expect(attrs.password).toBe('[REDACTED]');
    expect(attrs.apiKey).toBe('[REDACTED]');
    expect(attrs.safe).toBe('value');
  });

  it('redacts secret:// references', () => {
    const redactor = new LogRedactor();
    const out = redactor.redact('ref: secret://database/production password');
    expect(out).toContain('[REDACTED-SECRET-REF]');
    expect(out).not.toContain('secret://database');
  });
});

describe('LOG-007/008 store + query engine', () => {
  it('queries, tails and aggregates', () => {
    const { store, service } = buildService();
    service.emit('info', api, 'one');
    service.emit('error', api, 'two');
    service.emit('error', agent, 'three');

    expect(store.query({ level: 'error' })).toHaveLength(2);
    expect(store.query({ sourceId: 'developer-agent' })).toHaveLength(1);
    expect(store.query({ messageContains: 'two' })).toHaveLength(1);
    expect(store.tail(1)).toHaveLength(1);
    expect(store.count()).toBe(3);

    const stats = store.aggregate({});
    expect(stats.total).toBe(3);
    expect(stats.byLevel.error).toBe(2);
    expect(stats.bySource['vestara-api']).toBe(2);
  });
});
