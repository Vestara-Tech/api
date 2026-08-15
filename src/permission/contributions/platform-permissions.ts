import type { PermissionContributor, PermissionDefinition } from '../domain/contracts.js';

/**
 * PERM-014 — Platform module permission contributions. Every module declares
 * its permissions; the Permission Registry aggregates them. Installing a
 * Marketplace module can extend this registry.
 */
export function platformPermissionContributions(): readonly PermissionContributor[] {
  return [
    {
      moduleId: 'file',
      getPermissionDefinitions: (): PermissionDefinition[] => [
        def('file.read', 'file', 'read', 'low'),
        def('file.list', 'file', 'list', 'low'),
        def('file.search', 'file', 'search', 'low'),
        def('file.write', 'file', 'write', 'medium'),
        def('file.delete', 'file', 'delete', 'high'),
        def('file.transaction', 'file', 'transaction', 'medium'),
        def('file.system.write', 'file', 'system.write', 'critical', { approval: 'explicit' }),
      ],
    },
    {
      moduleId: 'agent',
      getPermissionDefinitions: (): PermissionDefinition[] => [
        def('agent.read', 'agent', 'read', 'low'),
        def('agent.run', 'agent', 'run', 'medium'),
        def('agent.delegate', 'agent', 'delegate', 'high', { approval: 'explicit' }),
        def('agent.tools', 'agent', 'tools', 'medium'),
        def('agent.skills', 'agent', 'skills', 'low'),
      ],
    },
    {
      moduleId: 'workflow',
      getPermissionDefinitions: (): PermissionDefinition[] => [
        def('workflow.read', 'workflow', 'read', 'low'),
        def('workflow.define', 'workflow', 'define', 'medium'),
        def('workflow.execute', 'workflow', 'execute', 'medium'),
        def('workflow.cancel', 'workflow', 'cancel', 'high'),
        def('workflow.publish', 'workflow', 'publish', 'high', { approval: 'explicit' }),
      ],
    },
    {
      moduleId: 'generator',
      getPermissionDefinitions: (): PermissionDefinition[] => [
        def('generator.read', 'generator', 'read', 'low'),
        def('generator.plan', 'generator', 'plan', 'low'),
        def('generator.run', 'generator', 'run', 'medium'),
        def('generator.apply', 'generator', 'apply', 'high', { approval: 'explicit' }),
      ],
    },
    {
      moduleId: 'system',
      getPermissionDefinitions: (): PermissionDefinition[] => [
        def('system.read', 'system', 'read', 'low'),
        def('system.configure', 'system', 'configure', 'critical', { approval: 'explicit' }),
        def('system.power.reboot', 'system', 'power.reboot', 'high', { approval: 'explicit' }),
        def('system.firmware.logo.apply', 'system', 'firmware.logo.apply', 'critical', { approval: 'explicit' }),
      ],
    },
    {
      moduleId: 'integration',
      getPermissionDefinitions: (): PermissionDefinition[] => [
        def('integration.read', 'integration', 'read', 'low'),
        def('integration.write', 'integration', 'write', 'high', { approval: 'explicit' }),
      ],
    },
  ];
}

function def(
  id: string,
  resource: string,
  action: string,
  risk: PermissionDefinition['risk'],
  extra: Partial<PermissionDefinition> = {},
): PermissionDefinition {
  return { id, resource, action, risk, ...extra };
}
