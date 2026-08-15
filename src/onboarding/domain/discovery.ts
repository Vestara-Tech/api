import { hostname, platform, release } from 'node:os';
import type { OnboardingContext } from '../service/onboarding-context.js';

export type DiscoveryStatus = 'present' | 'missing' | 'unknown';

export interface EnvironmentDiscovery {
  readonly hostname: string;
  readonly platform: string;
  readonly release: string;
  readonly architecture: string;
  readonly nodeVersion: string;
  readonly capabilities: readonly string[];
  readonly runtime: { readonly authentication: DiscoveryStatus; readonly configuration: DiscoveryStatus; readonly generator: DiscoveryStatus };
}

/**
 * ONB-006 — Environment discovery.
 *
 * Inspects what Vestara actually has available (OS, arch, node, and which
 * platform capabilities are present) so the wizard adapts rather than forcing
 * every installation through identical steps.
 */
export async function discoverEnvironment(context: OnboardingContext): Promise<EnvironmentDiscovery> {
  const capabilityNames = context.capabilities.listEnabled().map((c) => c.namespace);
  const has = (name: string): DiscoveryStatus => (capabilityNames.includes(name) ? 'present' : 'missing');

  return {
    hostname: hostname(),
    platform: platform(),
    release: release(),
    architecture: process.arch,
    nodeVersion: process.version,
    capabilities: capabilityNames,
    runtime: {
      authentication: has('auth'),
      configuration: has('config'),
      generator: has('generator'),
    },
  };
}
