import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../../src/config/schema.js';
import { DEFAULT_PORT } from '../../src/config/defaults.js';

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig({});
    expect(config.port).toBe(DEFAULT_PORT);
    expect(config.host).toBe('127.0.0.1');
    expect(config.logLevel).toBe('info');
    expect(config.apiVersion).toBe('v2');
    expect(config.service).toBe('vestara-api');
  });

  it('reads overrides', () => {
    const config = loadConfig({ VESTARA_API_PORT: '9999', VESTARA_API_HOST: '0.0.0.0', VESTARA_API_LOG_LEVEL: 'debug' });
    expect(config.port).toBe(9999);
    expect(config.host).toBe('0.0.0.0');
    expect(config.logLevel).toBe('debug');
  });

  it('rejects invalid port', () => {
    expect(() => loadConfig({ VESTARA_API_PORT: 'abc' })).toThrow(ConfigError);
  });

  it('rejects invalid log level', () => {
    expect(() => loadConfig({ VESTARA_API_LOG_LEVEL: 'verbose' })).toThrow(ConfigError);
  });
});
