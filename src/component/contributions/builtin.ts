import type { ComponentDefinition } from '../contracts.js';

function base(id: string, name: string, displayName: string, category: ComponentDefinition['category'], overrides: Partial<ComponentDefinition> = {}): ComponentDefinition {
  return {
    id,
    packageId: 'vestara.core',
    name,
    displayName,
    version: '1.0.0',
    category,
    renderer: { kind: 'react', import: id, path: `@vestara/ui/${name}` },
    properties: [],
    slots: [],
    events: [],
    actions: [],
    capabilities: [],
    permissions: [],
    designTokens: [],
    status: 'published',
    metadata: {},
    ...overrides,
  };
}

/** COMP-019 — built-in core component contributions. */
export function builtinComponents(): readonly ComponentDefinition[] {
  return [
    base('button', 'Button', 'Button', 'primitive', {
      properties: [
        { name: 'label', type: 'string', required: true },
        { name: 'variant', type: 'enum', enumValues: ['primary', 'secondary', 'danger'], defaultValue: 'primary' },
        { name: 'disabled', type: 'boolean', defaultValue: false },
        { name: 'icon', type: 'icon' },
      ],
      slots: [],
      events: [{ name: 'click', kind: 'click' }],
    }),
    base('card', 'Card', 'Card', 'layout', {
      slots: [
        { name: 'header', accepts: ['text', 'icon', 'layout'] },
        { name: 'content', accepts: ['*'] },
        { name: 'actions', accepts: ['button', 'menu'] },
      ],
    }),
    base('text', 'Text', 'Text', 'primitive', {
      properties: [{ name: 'content', type: 'string', required: true }],
    }),
    base('data-grid', 'DataGrid', 'Data Grid', 'data-grid', {
      properties: [
        { name: 'rows', type: 'binding' },
        { name: 'columns', type: 'array' },
      ],
      capabilities: ['database.read'],
    }),
    base('agent-status', 'AgentStatus', 'Agent Status', 'agent', {
      properties: [{ name: 'agentId', type: 'binding' }],
      capabilities: ['agent.read'],
    }),
    base('workflow-graph', 'WorkflowGraph', 'Workflow Graph', 'workflow', {
      capabilities: ['workflow.read'],
    }),
    base('system-health', 'SystemHealth', 'System Health', 'system', {
      properties: [
        { name: 'refreshInterval', type: 'number', defaultValue: 5000 },
        { name: 'showCpu', type: 'boolean', defaultValue: true },
        { name: 'showMemory', type: 'boolean', defaultValue: true },
      ],
      capabilities: ['system.read', 'diagnostics.read'],
    }),
  ];
}
