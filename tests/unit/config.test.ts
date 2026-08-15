import { strict as assert } from 'node:assert';
import test from 'node:test';
import { ConfigError, loadConfig } from '../../src/config/schema.js';
import { DEFAULT_PORT } from '../../src/config/defaults.js';

test('loadConfig applies defaults', () => {
  const config = loadConfig({});
  assert.equal(config.port, DEFAULT_PORT);
  assert.equal(config.host, '127.0.0.1');
  assert.equal(config.logLevel, 'info');
  assert.equal(config.apiVersion, 'v2');
  assert.equal(config.service, 'vestara-api');
});

test('loadConfig reads overrides', () => {
  const config = loadConfig({
    VESTARA_API_PORT: '9999',
    VESTARA_API_HOST: '0.0.0.0',
    VESTARA_API_LOG_LEVEL: 'debug',
  });
  assert.equal(config.port, 9999);
  assert.equal(config.host, '0.0.0.0');
  assert.equal(config.logLevel, 'debug');
});

test('loadConfig rejects invalid port', () => {
  assert.throws(() => loadConfig({ VESTARA_API_PORT: 'abc' }), ConfigError);
});

test('loadConfig rejects invalid log level', () => {
  assert.throws(() => loadConfig({ VESTARA_API_LOG_LEVEL: 'verbose' }), ConfigError);
});
