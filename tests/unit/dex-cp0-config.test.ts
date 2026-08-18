import { describe, expect, it } from 'vitest';
import { loadOpenCodeConfig } from '../../src/car/domain/opencode-config.js';

/** Helper: valid env for external mode (the default). */
const externalEnv = (overrides?: Record<string, string>) => ({
  OPENCODE_MODE: 'external',
  OPENCODE_BASE_URL: 'http://127.0.0.1:4096',
  ...overrides,
});

/** Helper: valid env for managed mode. */
const managedEnv = (overrides?: Record<string, string>) => ({
  OPENCODE_MODE: 'managed',
  ...overrides,
});

describe('DEX-CP0 OpenCode environment configuration', () => {
  describe('defaults', () => {
    it('returns 30s startup timeout when not specified', () => {
      const config = loadOpenCodeConfig({ env: externalEnv() });
      expect(config.mode).toBe('external');
      expect(config.startupTimeoutMs).toBe(30_000);
      expect(config.baseUrl).toBe('http://127.0.0.1:4096');
    });

    it('managed mode allows no baseUrl', () => {
      const config = loadOpenCodeConfig({ env: managedEnv() });
      expect(config.mode).toBe('managed');
      expect(config.baseUrl).toBeUndefined();
    });
  });

  describe('environment loading', () => {
    it('reads OPENCODE_MODE from env', () => {
      const config = loadOpenCodeConfig({ env: managedEnv() });
      expect(config.mode).toBe('managed');
    });

    it('reads OPENCODE_BASE_URL from env', () => {
      const config = loadOpenCodeConfig({ env: externalEnv({ OPENCODE_BASE_URL: 'http://localhost:4096' }) });
      expect(config.baseUrl).toBe('http://localhost:4096');
    });

    it('reads OPENCODE_HOSTNAME from env', () => {
      const config = loadOpenCodeConfig({ env: managedEnv({ OPENCODE_HOSTNAME: '0.0.0.0' }) });
      expect(config.hostname).toBe('0.0.0.0');
    });

    it('reads OPENCODE_PORT from env', () => {
      const config = loadOpenCodeConfig({ env: managedEnv({ OPENCODE_PORT: '8080' }) });
      expect(config.port).toBe(8080);
    });

    it('reads OPENCODE_DEFAULT_PROVIDER from env', () => {
      const config = loadOpenCodeConfig({ env: externalEnv({ OPENCODE_DEFAULT_PROVIDER: 'anthropic' }) });
      expect(config.defaultProvider).toBe('anthropic');
    });

    it('reads OPENCODE_DEFAULT_MODEL from env', () => {
      const config = loadOpenCodeConfig({ env: externalEnv({ OPENCODE_DEFAULT_MODEL: 'claude-3-5-sonnet' }) });
      expect(config.defaultModel).toBe('claude-3-5-sonnet');
    });

    it('reads OPENCODE_STARTUP_TIMEOUT_MS from env', () => {
      const config = loadOpenCodeConfig({ env: managedEnv({ OPENCODE_STARTUP_TIMEOUT_MS: '60000' }) });
      expect(config.startupTimeoutMs).toBe(60_000);
    });

    it('treats empty strings as unset for non-mode fields', () => {
      const config = loadOpenCodeConfig({
        env: {
          OPENCODE_MODE: 'managed',
          OPENCODE_HOSTNAME: '',
          OPENCODE_DEFAULT_PROVIDER: '',
          OPENCODE_DEFAULT_MODEL: '',
        },
      });
      expect(config.mode).toBe('managed');
      expect(config.hostname).toBeUndefined();
      expect(config.defaultProvider).toBeUndefined();
      expect(config.defaultModel).toBeUndefined();
    });
  });

  describe('overrides', () => {
    it('overrides env values with explicit overrides', () => {
      const config = loadOpenCodeConfig({
        env: managedEnv({ OPENCODE_PORT: '3000' }),
        overrides: { mode: 'external', baseUrl: 'http://remote:4096' },
      });
      expect(config.mode).toBe('external');
      expect(config.baseUrl).toBe('http://remote:4096');
    });

    it('overrides take highest precedence', () => {
      const config = loadOpenCodeConfig({
        env: externalEnv({ OPENCODE_DEFAULT_PROVIDER: 'openai' }),
        overrides: { defaultProvider: 'anthropic' },
      });
      expect(config.defaultProvider).toBe('anthropic');
    });
  });

  describe('validation', () => {
    it('rejects invalid OPENCODE_MODE', () => {
      expect(() => loadOpenCodeConfig({ env: { OPENCODE_MODE: 'invalid' } })).toThrow(
        'OPENCODE_MODE must be "managed" or "external"',
      );
    });

    it('does not require baseUrl for external mode at load time', () => {
      // baseUrl validation happens at adapter connection time, not config load time.
      // This allows bootstrap to succeed even when OpenCode is not configured.
      const config = loadOpenCodeConfig({ env: { OPENCODE_MODE: 'external' } });
      expect(config.mode).toBe('external');
      expect(config.baseUrl).toBeUndefined();
    });

    it('rejects invalid OPENCODE_PORT', () => {
      expect(() => loadOpenCodeConfig({ env: managedEnv({ OPENCODE_PORT: 'abc' }) })).toThrow(
        'OPENCODE_PORT must be an integer between 1 and 65535',
      );
    });

    it('rejects negative OPENCODE_PORT', () => {
      expect(() => loadOpenCodeConfig({ env: managedEnv({ OPENCODE_PORT: '-1' }) })).toThrow(
        'OPENCODE_PORT must be an integer between 1 and 65535',
      );
    });

    it('rejects port above 65535', () => {
      expect(() => loadOpenCodeConfig({ env: managedEnv({ OPENCODE_PORT: '70000' }) })).toThrow(
        'OPENCODE_PORT must be an integer between 1 and 65535',
      );
    });

    it('rejects non-integer OPENCODE_PORT', () => {
      expect(() => loadOpenCodeConfig({ env: managedEnv({ OPENCODE_PORT: '1.5' }) })).toThrow(
        'OPENCODE_PORT must be an integer between 1 and 65535',
      );
    });

    it('rejects zero OPENCODE_STARTUP_TIMEOUT_MS', () => {
      expect(() => loadOpenCodeConfig({ env: managedEnv({ OPENCODE_STARTUP_TIMEOUT_MS: '0' }) })).toThrow(
        'OPENCODE_STARTUP_TIMEOUT_MS must be a positive integer',
      );
    });

    it('rejects negative OPENCODE_STARTUP_TIMEOUT_MS', () => {
      expect(() => loadOpenCodeConfig({ env: managedEnv({ OPENCODE_STARTUP_TIMEOUT_MS: '-100' }) })).toThrow(
        'OPENCODE_STARTUP_TIMEOUT_MS must be a positive integer',
      );
    });

    it('rejects non-numeric OPENCODE_STARTUP_TIMEOUT_MS', () => {
      expect(() => loadOpenCodeConfig({ env: managedEnv({ OPENCODE_STARTUP_TIMEOUT_MS: 'abc' }) })).toThrow(
        'OPENCODE_STARTUP_TIMEOUT_MS must be a positive integer',
      );
    });

    it('allows provider without model', () => {
      const config = loadOpenCodeConfig({ env: externalEnv({ OPENCODE_DEFAULT_PROVIDER: 'anthropic' }) });
      expect(config.defaultProvider).toBe('anthropic');
      expect(config.defaultModel).toBeUndefined();
    });

    it('allows model without provider', () => {
      const config = loadOpenCodeConfig({ env: externalEnv({ OPENCODE_DEFAULT_MODEL: 'claude-3-5-sonnet' }) });
      expect(config.defaultModel).toBe('claude-3-5-sonnet');
      expect(config.defaultProvider).toBeUndefined();
    });

    it('allows managed mode without baseUrl', () => {
      const config = loadOpenCodeConfig({ env: managedEnv() });
      expect(config.mode).toBe('managed');
      expect(config.baseUrl).toBeUndefined();
    });

    it('allows external mode with override but no baseUrl at load time', () => {
      const config = loadOpenCodeConfig({
        env: managedEnv(),
        overrides: { mode: 'external' },
      });
      expect(config.mode).toBe('external');
      expect(config.baseUrl).toBeUndefined();
    });
  });

  describe('precedence', () => {
    it('overrides take precedence over env vars', () => {
      const config = loadOpenCodeConfig({
        env: managedEnv({ OPENCODE_DEFAULT_PROVIDER: 'openai' }),
        overrides: { mode: 'external', baseUrl: 'http://remote:4096', defaultProvider: 'anthropic' },
      });
      expect(config.mode).toBe('external');
      expect(config.baseUrl).toBe('http://remote:4096');
      expect(config.defaultProvider).toBe('anthropic');
    });

    it('env vars take precedence over defaults', () => {
      const config = loadOpenCodeConfig({
        env: managedEnv({ OPENCODE_STARTUP_TIMEOUT_MS: '5000' }),
      });
      expect(config.startupTimeoutMs).toBe(5000);
    });
  });
});
