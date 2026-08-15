/**
 * LOGIN-012 — Pre-auth system capabilities.
 *
 * An unauthenticated greeter gets a very restricted set of capabilities —
 * never the normal authenticated System API.
 */
export type PreAuthCapability =
  | 'preauth.network.status'
  | 'preauth.network.connect'
  | 'preauth.accessibility'
  | 'preauth.locale'
  | 'preauth.power.reboot'
  | 'preauth.power.shutdown'
  | 'preauth.recovery.boot'
  | 'preauth.session.select';

export const PREAUTH_CAPABILITIES: readonly PreAuthCapability[] = [
  'preauth.network.status',
  'preauth.network.connect',
  'preauth.accessibility',
  'preauth.locale',
  'preauth.power.reboot',
  'preauth.power.shutdown',
  'preauth.recovery.boot',
  'preauth.session.select',
];

export const FORBIDDEN_PREAUTH = [
  'builder',
  'generator',
  'config.write',
  'marketplace',
  'filesystem',
  'agents',
  'integrations',
  'system.arbitrary',
] as const;

export function isPreAuthAllowed(capability: string): boolean {
  return PREAUTH_CAPABILITIES.includes(capability as PreAuthCapability);
}
