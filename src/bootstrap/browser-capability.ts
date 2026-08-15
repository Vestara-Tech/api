import type { CapabilityRegistry } from '../capabilities/registry.js';
import type { AppConfig } from '../config/schema.js';

export function registerBrowserCapability(registry: CapabilityRegistry, config: AppConfig): void {
  registry.register({
    id: 'vestara.api.browser',
    namespace: 'browser',
    version: config.apiVersion,
    permissions: ['browser.read', 'browser.interact', 'browser.authenticate', 'browser.execute-script'],
    operations: ['browser.profiles.list', 'browser.session.create', 'browser.navigate', 'browser.screenshot', 'browser.sessions.list', 'browser.evidence.list'],
  });
}
